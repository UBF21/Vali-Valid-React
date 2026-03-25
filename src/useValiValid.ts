import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldValidationConfig, FormErrors, ValidationsConfig, ValiValid } from 'vali-valid';

function deepClone<V>(value: V): V {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return new Date((value as Date).getTime()) as unknown as V;
    if (Array.isArray(value)) return (value as unknown[]).map(deepClone) as unknown as V;
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    Object.keys(src).forEach((k) => { out[k] = deepClone(src[k]); });
    return out as V;
}

/**
 * Options for the `useValiValid` React hook.
 * @template T - Form data shape
 */
export interface UseValiValidOptions<T extends Record<string, any>> {
    /** Initial form values. */
    initial: T;
    /** Validation rules per field. */
    validations?: FieldValidationConfig<T>[];
    /** Validate each field when it loses focus. Default: false */
    validateOnBlur?: boolean;
    /** Only validate after the first submit attempt. Default: false */
    validateOnSubmit?: boolean;
    /** Debounce delay (ms) before running async validators on change. Default: 0 */
    debounceMs?: number;
    /** 'all' returns all errors per field; 'firstError' stops at the first. Default: 'all' */
    criteriaMode?: 'all' | 'firstError';
    /** Per-instance locale override (e.g. 'en', 'es', 'pt', 'fr', 'de'). Does not mutate the global locale. */
    locale?: string;
    /** Run full validation when the component mounts. Default: false */
    validateOnMount?: boolean;
    /** Timeout (ms) for async validators. Validators that exceed this are rejected. Default: 10000 */
    asyncTimeout?: number;
}

/**
 * Return value of `useValiValid`.
 * @template T - Form data shape
 */
export interface UseValiValidReturn<T extends Record<string, any>> {
    /** Current form values. */
    form: T;
    /** Per-field error state. undefined=untouched, null=valid, string[]=errors */
    errors: FormErrors<T>;
    /** True when all validated fields are null (valid) or untouched. */
    isValid: boolean;
    /** True while async validation is in progress. */
    isValidating: boolean;
    /** True after the first handleSubmit() call. */
    isSubmitted: boolean;
    /** True while handleSubmit() is executing (prevents double-submit). */
    isSubmitting: boolean;
    /** Number of times handleSubmit() has been called. */
    submitCount: number;
    /** Set of fields the user has blurred at least once. */
    touchedFields: Set<keyof T>;
    /** Set of fields whose value differs from the initial value. */
    dirtyFields: Set<keyof T>;
    /** Update a field value and optionally trigger validation. */
    handleChange: (field: keyof T, value: any) => void;
    /** Mark a field as touched and optionally trigger blur validation. */
    handleBlur: (field: keyof T) => void;
    /** Runs full validation (sync + async) on all fields. Returns FormErrors<T>. */
    validate: () => Promise<FormErrors<T>>;
    /** Resets form to initial values and clears all errors and state. */
    reset: (initial?: Partial<T>) => void;
    /** Wraps a submit handler: validates first, calls handler only if valid. */
    handleSubmit: (onSubmit: (form: T) => void | Promise<void>) => (e?: Event) => Promise<void>;
    /** Injects server-side errors into the error state. */
    setServerErrors: (errors: Partial<FormErrors<T>>) => void;
    /** Programmatically set one or more field values. */
    setValues: (values: Partial<T>) => void;
    addFieldValidation: (field: keyof T, validations: ValidationsConfig[]) => void;
    removeFieldValidation: (field: keyof T, type: string) => void;
    setFieldValidations: (field: keyof T, validations: ValidationsConfig[]) => void;
    clearFieldValidations: (field: keyof T) => void;
    /** Manually trigger validation for a field or all fields. Returns FormErrors<T>. */
    trigger: (field?: keyof T) => Promise<FormErrors<T>>;
    /** Clears errors for one field (or all fields if no argument). */
    clearErrors: (field?: keyof T) => void;
    /** Returns a deep clone of the current form state. */
    getValues: () => T;
}

/**
 * React hook for form validation with vali-valid.
 *
 * @template T - Shape of the form data object
 * @param options - Hook configuration (see UseValiValidOptions)
 * @returns Form state, errors, and handlers (see UseValiValidReturn)
 *
 * @example
 * const { form, errors, handleChange, handleSubmit, isValid } = useValiValid({
 *   initial: { email: '', password: '' },
 *   validations: [
 *     { field: 'email', validations: rule().required().email().build() },
 *     { field: 'password', validations: rule().required().minLength(8).build() },
 *   ],
 * });
 */
export function useValiValid<T extends Record<string, any>>(
    options: UseValiValidOptions<T>
): UseValiValidReturn<T> {
    const { initial, validations = [], validateOnBlur = false, validateOnSubmit = false, debounceMs = 0, criteriaMode = 'all', locale, validateOnMount = false, asyncTimeout = 10_000 } = options;

    const engineRef = useRef<ValiValid<T>>(new ValiValid<T>(validations, { criteriaMode, locale, asyncTimeout }));
    // _originalInitial: immutable — never mutated; base for bare reset()
    // Stored as sanitized values so dirty comparison is apples-to-apples with handleChange output.
    // Lazy ref pattern: computation only runs once (on first render), not on every render.
    const _originalInitialRef = useRef<T | null>(null);
    if (_originalInitialRef.current === null) {
        const sanitized = {} as T;
        for (const k of Object.keys(initial)) {
            sanitized[k as keyof T] = engineRef.current.getFieldValue(k as keyof T, initial[k as keyof T]);
        }
        _originalInitialRef.current = sanitized;
    }
    // Safe non-null alias — guaranteed to be set by the block above
    const _originalInitial = _originalInitialRef.current!;
    // _dirtyBase: updated by reset(newInitial) for dirty comparisons
    const _dirtyBaseRef = useRef<T>(deepClone(_originalInitial));

    const [form, setForm] = useState<T>(initial);
    const [errors, setErrors] = useState<FormErrors<T>>({});
    const [isValidating, setIsValidating] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submitCount, setSubmitCount] = useState(0);
    const [touchedFields, setTouchedFields] = useState<Set<keyof T>>(new Set());
    const [dirtyFields, setDirtyFields] = useState<Set<keyof T>>(new Set());

    const formRef = useRef<T>(form);
    formRef.current = form;
    const errorsRef = useRef<FormErrors<T>>({});
    errorsRef.current = errors;

    // Global epoch: incremented on reset/validate/handleChange to invalidate stale async results
    const _epochRef = useRef(0);
    // Per-field epoch: incremented in _cancelFieldAsync to cancel a single field without breaking validate()
    const _fieldEpochRef = useRef<Map<string, number>>(new Map());
    // In-flight debounce timers per field
    const _debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    // Count of in-flight async promises per field
    const _asyncInFlightRef = useRef<Map<string, number>>(new Map());

    const _isSubmitting = useRef(false);
    const [isSubmitting, _setIsSubmitting] = useState(false);

    const _mountedRef = useRef(false);
    useEffect(() => {
        if (!validateOnMount || _mountedRef.current) return;
        _mountedRef.current = true;
        validate();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup on unmount: clear all pending debounce timers and cancel async operations
    useEffect(() => {
        return () => {
            _debounceTimersRef.current.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
            _debounceTimersRef.current.clear();
            _asyncInFlightRef.current.clear();
            _epochRef.current = -1; // sentinel: stale check will always fail after unmount
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const computeIsValid = (errs: FormErrors<T>): boolean => {
        const vals = Object.values(errs);
        if (vals.length === 0) return true;
        return vals.every((e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0));
    };

    const isValid = computeIsValid(errors);

    function _withTimeout<R>(p: Promise<R>, ms: number): Promise<R> {
        if (ms <= 0) return p;
        let timerId: ReturnType<typeof setTimeout>;
        const timeout = new Promise<R>((_, reject) => {
            timerId = setTimeout(() => reject(new Error('[ValiValid] Async timeout')), ms);
        });
        return Promise.race([
            p.then((v) => { clearTimeout(timerId!); return v; }, (e) => { clearTimeout(timerId!); throw e; }),
            timeout,
        ]);
    }

    function _checkIsValidating(): void {
        if (_debounceTimersRef.current.size === 0 && _asyncInFlightRef.current.size === 0) {
            setIsValidating(false);
        }
    }

    function _cancelFieldAsync(field: keyof T): void {
        const key = String(field);
        const existing = _debounceTimersRef.current.get(key);
        if (existing) { clearTimeout(existing); _debounceTimersRef.current.delete(key); }
        _asyncInFlightRef.current.delete(key);
        _fieldEpochRef.current.set(key, (_fieldEpochRef.current.get(key) ?? 0) + 1);
        _checkIsValidating();
    }

    const runFieldValidation = useCallback((field: keyof T, sanitized: any) => {
        const engine = engineRef.current;
        const syncError = engine.validateFieldSync(field, sanitized, formRef.current);
        setErrors((prev: FormErrors<T>) => ({ ...prev, [field]: syncError }));

        if (engine.hasAsyncRules(field)) {
            const fieldKey = String(field);
            const existing = _debounceTimersRef.current.get(fieldKey);
            if (existing) clearTimeout(existing);
            setIsValidating(true);
            const epoch = _epochRef.current;
            const fEpoch = _fieldEpochRef.current.get(fieldKey) ?? 0;

            const timer = setTimeout(async () => {
                _debounceTimersRef.current.delete(fieldKey);
                _asyncInFlightRef.current.set(fieldKey, (_asyncInFlightRef.current.get(fieldKey) ?? 0) + 1);
                try {
                    const asyncError = await _withTimeout(engine.validateFieldAsync(field, sanitized, formRef.current), asyncTimeout);
                    if (_epochRef.current !== epoch || (_fieldEpochRef.current.get(fieldKey) ?? 0) !== fEpoch) return;
                    setErrors((prev: FormErrors<T>) => ({ ...prev, [field]: asyncError }));
                } catch {
                    // leave existing error
                } finally {
                    const remaining = (_asyncInFlightRef.current.get(fieldKey) ?? 1) - 1;
                    if (remaining <= 0) _asyncInFlightRef.current.delete(fieldKey);
                    else _asyncInFlightRef.current.set(fieldKey, remaining);
                    _checkIsValidating();
                }
            }, debounceMs);

            _debounceTimersRef.current.set(fieldKey, timer);
        }

        // Re-validate fields that watch this field
        engine.getWatchedFields(String(field)).forEach((wf: string) => {
            const wSanitized = engine.getFieldValue(wf as keyof T, formRef.current[wf as keyof T]);
            const wErr = engine.validateFieldSync(wf as keyof T, wSanitized, formRef.current);
            setErrors((prev: FormErrors<T>) => ({ ...prev, [wf]: wErr }));
        });
    }, [debounceMs, asyncTimeout]);

    const handleChange = useCallback((field: keyof T, value: any) => {
        _epochRef.current += 1;
        const engine = engineRef.current;
        const sanitized = engine.getFieldValue(field, value);

        setForm((prev: T) => {
            const next = { ...prev, [field]: sanitized };
            formRef.current = next;
            return next;
        });

        setDirtyFields((prev: Set<keyof T>) => {
            const next = new Set(prev);
            if (sanitized !== _dirtyBaseRef.current[field]) {
                next.add(field);
            } else {
                next.delete(field);
            }
            return next;
        });

        const skipValidation = validateOnBlur || (validateOnSubmit && !isSubmitted);
        if (!skipValidation) {
            runFieldValidation(field, sanitized);
        }
    }, [validateOnBlur, validateOnSubmit, isSubmitted, runFieldValidation]);

    const handleBlur = useCallback((field: keyof T) => {
        setTouchedFields((prev: Set<keyof T>) => {
            const next = new Set(prev);
            next.add(field);
            return next;
        });

        const shouldValidate = validateOnBlur || (validateOnSubmit && isSubmitted);
        if (shouldValidate) {
            const engine = engineRef.current;
            const sanitized = engine.getFieldValue(field, formRef.current[field]);
            runFieldValidation(field, sanitized);
        }
    }, [validateOnBlur, validateOnSubmit, isSubmitted, runFieldValidation]);

    const validate = useCallback(async (): Promise<FormErrors<T>> => {
        // Cancel pending per-field async timers so they don't overwrite the full-validate result
        _debounceTimersRef.current.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
        _debounceTimersRef.current.clear();
        _asyncInFlightRef.current.clear();
        _epochRef.current += 1;
        const epoch = _epochRef.current;
        setIsValidating(true);
        try {
            const allErrors = await engineRef.current.validateAsync(formRef.current);
            if (_epochRef.current !== epoch) return allErrors;
            setErrors(allErrors);
            return allErrors;
        } finally {
            if (_epochRef.current === epoch) setIsValidating(false);
        }
    }, []);

    const reset = useCallback((newInitial?: Partial<T>) => {
        _isSubmitting.current = false;
        _setIsSubmitting(false);
        const next = (newInitial
            ? { ...deepClone(_originalInitialRef.current!), ...newInitial }
            : deepClone(_originalInitialRef.current!)) as T;
        _dirtyBaseRef.current = next;
        _epochRef.current += 1;
        _debounceTimersRef.current.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
        _debounceTimersRef.current.clear();
        _asyncInFlightRef.current.clear();
        setForm(next);
        formRef.current = next;
        setErrors({});
        setIsValidating(false);
        setIsSubmitted(false);
        setSubmitCount(0);
        setTouchedFields(new Set());
        setDirtyFields(new Set());
    }, []);

    const handleSubmit = useCallback(
        (onSubmit: (form: T) => void | Promise<void>) => async (e?: Event): Promise<void> => {
            e?.preventDefault?.();
            if (_isSubmitting.current) return;
            _isSubmitting.current = true;
            _setIsSubmitting(true);
            try {
                setIsSubmitted(true);
                setSubmitCount((n: number) => n + 1);
                const allErrors = await validate();
                const valid = Object.values(allErrors).every(
                    (e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0)
                );
                if (valid) await onSubmit(formRef.current);
            } finally {
                _isSubmitting.current = false;
                _setIsSubmitting(false);
            }
        },
        [validate]
    );

    const setServerErrors = useCallback((serverErrors: Partial<FormErrors<T>>) => {
        setErrors((prev: FormErrors<T>) => ({ ...prev, ...serverErrors }));
    }, []);

    const setValues = useCallback((values: Partial<T>) => {
        const engine = engineRef.current;
        const sanitized: Partial<T> = {};
        Object.keys(values).forEach((k) => {
            sanitized[k as keyof T] = engine.getFieldValue(k as keyof T, values[k as keyof T]);
        });
        setForm((prev: T) => {
            const next = { ...prev, ...sanitized };
            formRef.current = next;
            return next;
        });
        setDirtyFields((prev: Set<keyof T>) => {
            const next = new Set(prev);
            Object.keys(sanitized).forEach((k) => {
                if (sanitized[k as keyof T] !== _dirtyBaseRef.current[k as keyof T]) next.add(k as keyof T);
                else next.delete(k as keyof T);
            });
            return next;
        });
        const skipValidation = validateOnBlur || (validateOnSubmit && !isSubmitted);
        if (!skipValidation) {
            Object.keys(sanitized).forEach((k) => {
                runFieldValidation(k as keyof T, sanitized[k as keyof T]);
            });
        }
    }, [validateOnBlur, validateOnSubmit, isSubmitted, runFieldValidation]);

    const addFieldValidation = useCallback((field: keyof T, validationList: ValidationsConfig[]) => {
        _cancelFieldAsync(field);
        engineRef.current.addFieldValidation(field, validationList);
    }, []);

    const removeFieldValidation = useCallback((field: keyof T, type: string) => {
        _cancelFieldAsync(field);
        engineRef.current.removeFieldValidation(field, type);
    }, []);

    const setFieldValidations = useCallback((field: keyof T, validationList: ValidationsConfig[]) => {
        _cancelFieldAsync(field);
        engineRef.current.setFieldValidations(field, validationList);
    }, []);

    const clearFieldValidations = useCallback((field: keyof T) => {
        _cancelFieldAsync(field);
        engineRef.current.clearFieldValidations(field);
        setErrors((prev: FormErrors<T>) => ({ ...prev, [field]: null }));
    }, []);

    const trigger = useCallback(async (field?: keyof T): Promise<FormErrors<T>> => {
        if (field !== undefined) {
            _cancelFieldAsync(field);
            const engine = engineRef.current;
            const sanitized = engine.getFieldValue(field, formRef.current[field]);
            const syncError = engine.validateFieldSync(field, sanitized, formRef.current);
            const asyncError = engine.hasAsyncRules(field)
                ? await _withTimeout(engine.validateFieldAsync(field, sanitized, formRef.current), asyncTimeout)
                : syncError;
            setErrors((prev: FormErrors<T>) => ({ ...prev, [field]: asyncError }));
            return { ...errorsRef.current, [field]: asyncError } as FormErrors<T>;
        }
        return validate();
    }, [validate, asyncTimeout]);

    const clearErrors = useCallback((field?: keyof T) => {
        if (field !== undefined) {
            setErrors((prev: FormErrors<T>) => ({ ...prev, [field]: null }));
        } else {
            setErrors({});
        }
    }, []);

    const getValues = useCallback((): T => {
        return deepClone(formRef.current);
    }, []); // formRef is stable, no deps needed

    return {
        form,
        errors,
        isValid,
        isValidating,
        isSubmitted,
        isSubmitting,
        submitCount,
        touchedFields,
        dirtyFields,
        handleChange,
        handleBlur,
        validate,
        reset,
        handleSubmit,
        setServerErrors,
        setValues,
        addFieldValidation,
        removeFieldValidation,
        setFieldValidations,
        clearFieldValidations,
        trigger,
        clearErrors,
        getValues,
    };
}
