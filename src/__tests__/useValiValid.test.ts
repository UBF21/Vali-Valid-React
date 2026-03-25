import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValiValid } from '../useValiValid';
import { ValidationType } from 'vali-valid';
import { FieldValidationConfig, ValidationsConfig } from 'vali-valid';

describe('useValiValid hook', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.MinLength, value: 3 } as ValidationsConfig] },
    ];

    describe('basic functionality', () => {
        it('initializes with empty errors and isValid true', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            expect(result.current.errors).toEqual({});
            expect(result.current.isValid).toBe(true);
        });

        it('handleChange updates form value', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            act(() => {
                result.current.handleChange('email', 'test@example.com');
            });
            expect(result.current.form.email).toBe('test@example.com');
        });

        it('handleChange validates and sets errors as array', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            act(() => {
                result.current.handleChange('email', 'invalid-email');
            });
            expect(Array.isArray(result.current.errors.email)).toBe(true);
        });
    });

    describe('isValid computed correctly', () => {
        it('isValid is false when there are errors', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            await act(async () => {
                await result.current.validate();
            });
            expect(result.current.isValid).toBe(false);
        });

        it('isValid is true when all fields pass', async () => {
            const { result } = renderHook(() =>
                useValiValid({
                    initial: { email: 'test@example.com', name: 'John' },
                    validations
                })
            );
            await act(async () => {
                await result.current.validate();
            });
            expect(result.current.isValid).toBe(true);
        });
    });

    describe('setServerErrors', () => {
        it('injects external errors into state', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            act(() => {
                result.current.setServerErrors({ email: ['This email is already taken'] });
            });
            expect(result.current.errors.email).toEqual(['This email is already taken']);
            expect(result.current.isValid).toBe(false);
        });
    });

    describe('handleSubmit', () => {
        it('calls onSubmit when form is valid', async () => {
            const onSubmit = vi.fn();
            const { result } = renderHook(() =>
                useValiValid({
                    initial: { email: 'test@example.com', name: 'John' },
                    validations
                })
            );
            await act(async () => {
                await result.current.handleSubmit(onSubmit)();
            });
            expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com', name: 'John' });
        });

        it('does NOT call onSubmit when form is invalid', async () => {
            const onSubmit = vi.fn();
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            await act(async () => {
                await result.current.handleSubmit(onSubmit)();
            });
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it('increments submitCount on each call', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            expect(result.current.submitCount).toBe(0);
            await act(async () => {
                await result.current.handleSubmit(() => {})();
                await result.current.handleSubmit(() => {})();
            });
            expect(result.current.submitCount).toBe(2);
        });

        it('sets isSubmitted to true after first submit', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            expect(result.current.isSubmitted).toBe(false);
            await act(async () => {
                await result.current.handleSubmit(() => {})();
            });
            expect(result.current.isSubmitted).toBe(true);
        });
    });

    describe('setValues', () => {
        it('updates multiple fields at once', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            act(() => {
                result.current.setValues({ email: 'test@example.com', name: 'Alice' });
            });
            expect(result.current.form.email).toBe('test@example.com');
            expect(result.current.form.name).toBe('Alice');
        });

        it('marks fields as dirty when different from initial', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            act(() => {
                result.current.setValues({ email: 'new@example.com' });
            });
            expect(result.current.dirtyFields.has('email')).toBe(true);
            expect(result.current.dirtyFields.has('name')).toBe(false);
        });
    });

    describe('validateOnSubmit mode', () => {
        it('does not validate on handleChange when validateOnSubmit is true', () => {
            const { result } = renderHook(() =>
                useValiValid({
                    initial: { email: '' },
                    validations,
                    validateOnSubmit: true,
                })
            );
            act(() => {
                result.current.handleChange('email', 'invalid');
            });
            expect(result.current.errors.email).toBeUndefined();
        });

        it('validates on handleSubmit regardless of validateOnSubmit', async () => {
            const { result } = renderHook(() =>
                useValiValid({
                    initial: { email: '' },
                    validations,
                    validateOnSubmit: true,
                })
            );
            await act(async () => {
                await result.current.handleSubmit(() => {})();
            });
            expect(result.current.errors.email).toBeInstanceOf(Array);
        });
    });

    describe('reset', () => {
        it('resets form, errors, and all state to initial', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            await act(async () => {
                result.current.handleChange('email', 'test@example.com');
                await result.current.handleSubmit(() => {})();
            });
            act(() => {
                result.current.reset();
            });
            expect(result.current.form.email).toBe('');
            expect(result.current.errors).toEqual({});
            expect(result.current.isSubmitted).toBe(false);
            expect(result.current.submitCount).toBe(0);
            expect(result.current.dirtyFields.size).toBe(0);
        });

        it('reset(newInitial) clears dirty fields; subsequent change compares to new reset baseline', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            // Make email dirty first
            act(() => {
                result.current.handleChange('email', 'changed@example.com');
            });
            expect(result.current.dirtyFields.has('email')).toBe(true);
            // reset clears dirty fields
            act(() => {
                result.current.reset({ email: 'new@example.com' });
            });
            expect(result.current.dirtyFields.size).toBe(0);
            // After reset(newInitial), the new baseline is 'new@example.com', so setting
            // email back to 'new@example.com' is NOT dirty
            act(() => {
                result.current.handleChange('email', 'new@example.com');
            });
            expect(result.current.dirtyFields.has('email')).toBe(false);
            // But changing to a different value IS dirty relative to the new baseline
            act(() => {
                result.current.handleChange('email', 'other@example.com');
            });
            expect(result.current.dirtyFields.has('email')).toBe(true);
        });
    });

    describe('dirtyFields tracking', () => {
        it('marks field as dirty when changed from initial', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            act(() => {
                result.current.handleChange('email', 'new@example.com');
            });
            expect(result.current.dirtyFields.has('email')).toBe(true);
        });

        it('removes dirty mark when value returns to initial', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: 'original@example.com' }, validations })
            );
            act(() => {
                result.current.handleChange('email', 'changed@example.com');
            });
            expect(result.current.dirtyFields.has('email')).toBe(true);
            act(() => {
                result.current.handleChange('email', 'original@example.com');
            });
            expect(result.current.dirtyFields.has('email')).toBe(false);
        });
    });

    describe('touchedFields tracking', () => {
        it('marks field as touched on blur', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            act(() => {
                result.current.handleBlur('email');
            });
            expect(result.current.touchedFields.has('email')).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// NEW describe blocks — appended below existing suite
// ---------------------------------------------------------------------------

describe('useValiValid — validateOnBlur mode', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.MinLength, value: 3 } as ValidationsConfig] },
    ];

    it('handleChange does NOT set errors when validateOnBlur is true', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnBlur: true })
        );
        act(() => {
            result.current.handleChange('email', 'not-an-email');
        });
        expect(result.current.errors.email).toBeUndefined();
    });

    it('handleBlur DOES trigger validation and sets errors when validateOnBlur is true', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnBlur: true })
        );
        act(() => {
            result.current.handleChange('email', 'not-an-email');
            result.current.handleBlur('email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBeGreaterThan(0);
    });

    it('handleBlur sets null error when field is valid and validateOnBlur is true', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnBlur: true })
        );
        act(() => {
            result.current.handleChange('email', 'valid@example.com');
            result.current.handleBlur('email');
        });
        expect(result.current.errors.email).toBeNull();
    });

    it('handleChange immediately validates when validateOnBlur is false (default)', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnBlur: false })
        );
        act(() => {
            result.current.handleChange('email', 'not-an-email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
    });

    it('multiple handleBlur calls on same field do not duplicate touchedFields', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnBlur: true })
        );
        act(() => {
            result.current.handleBlur('email');
            result.current.handleBlur('email');
            result.current.handleBlur('email');
        });
        expect(result.current.touchedFields.size).toBe(1);
    });
});

describe('useValiValid — validateOnSubmit mode (extended)', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('handleChange does NOT validate before first submit when validateOnSubmit is true', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnSubmit: true })
        );
        act(() => {
            result.current.handleChange('email', 'bad-email');
        });
        expect(result.current.errors.email).toBeUndefined();
    });

    it('handleBlur does NOT validate before first submit when validateOnSubmit is true', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnSubmit: true })
        );
        act(() => {
            result.current.handleBlur('email');
        });
        // errors should not be set before first submit
        expect(result.current.errors.email).toBeUndefined();
    });

    it('after handleSubmit, handleBlur validates because isSubmitted is true', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnSubmit: true })
        );
        await act(async () => {
            await result.current.handleSubmit(() => {})();
        });
        // isSubmitted is now true; changing and blurring should trigger validation
        act(() => {
            result.current.handleChange('email', 'bad-email');
            result.current.handleBlur('email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
    });

    it('after handleSubmit with invalid form errors are set on all fields', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations, validateOnSubmit: true })
        );
        await act(async () => {
            await result.current.handleSubmit(() => {})();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });
});

describe('useValiValid — addFieldValidation / removeFieldValidation / setFieldValidations / clearFieldValidations', () => {
    it('addFieldValidation on valid field adds new rule making it invalid', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { code: 'hello' }, validations: [] })
        );
        // initially no rules — field validates to null (valid)
        act(() => {
            result.current.handleChange('code', 'hello');
        });
        expect(result.current.errors.code).toBeNull();

        // add a DigitsOnly rule — now 'hello' is invalid
        act(() => {
            result.current.addFieldValidation('code', [{ type: ValidationType.DigitsOnly } as ValidationsConfig]);
        });
        act(() => {
            result.current.handleChange('code', 'hello');
        });
        expect(Array.isArray(result.current.errors.code)).toBe(true);
    });

    it('removeFieldValidation removes a rule so field becomes valid', () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'code', validations: [{ type: ValidationType.DigitsOnly } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { code: '' }, validations })
        );
        act(() => {
            result.current.handleChange('code', 'abc');
        });
        expect(Array.isArray(result.current.errors.code)).toBe(true);

        act(() => {
            result.current.removeFieldValidation('code', ValidationType.DigitsOnly);
        });
        act(() => {
            result.current.handleChange('code', 'abc');
        });
        expect(result.current.errors.code).toBeNull();
    });

    it('setFieldValidations replaces all rules — old rule no longer applies', () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'code', validations: [{ type: ValidationType.DigitsOnly } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { code: '' }, validations })
        );
        // DigitsOnly would fail for 'abc'
        act(() => {
            result.current.handleChange('code', 'abc');
        });
        expect(Array.isArray(result.current.errors.code)).toBe(true);

        // Replace with Alpha rule (letters only) — now 'abc' is valid
        act(() => {
            result.current.setFieldValidations('code', [{ type: ValidationType.Alpha } as ValidationsConfig]);
        });
        act(() => {
            result.current.handleChange('code', 'abc');
        });
        expect(result.current.errors.code).toBeNull();
    });

    it('clearFieldValidations makes field always return null', () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'code', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { code: '' }, validations })
        );
        act(() => {
            result.current.handleChange('code', 'not-valid');
        });
        expect(Array.isArray(result.current.errors.code)).toBe(true);

        act(() => {
            result.current.clearFieldValidations('code');
        });
        // After clearing, errors for the field should be null
        expect(result.current.errors.code).toBeNull();

        // Subsequent changes should also produce null
        act(() => {
            result.current.handleChange('code', 'still-not-valid');
        });
        expect(result.current.errors.code).toBeNull();
    });
});

describe('useValiValid — validate() full form', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.MinLength, value: 3 } as ValidationsConfig] },
    ];

    it('validate() sets errors for ALL fields simultaneously', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    it('validate() returns FormErrors object', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        let returnedErrors: any;
        await act(async () => {
            returnedErrors = await result.current.validate();
        });
        expect(returnedErrors).toBeDefined();
        expect(typeof returnedErrors).toBe('object');
        expect('email' in returnedErrors).toBe(true);
        expect('name' in returnedErrors).toBe(true);
    });

    it('after validate() with invalid data, isValid is false', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.isValid).toBe(false);
    });

    it('after validate() with valid data, isValid is true', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'good@example.com', name: 'Alice' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.isValid).toBe(true);
    });

    it('validate() sets isValidating false after completion', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.isValidating).toBe(false);
    });
});

describe('useValiValid — errors format (string[] | null)', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('after validation failure, errors.fieldName is an array', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        act(() => {
            result.current.handleChange('email', 'not-an-email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
    });

    it('after validation pass, errors.fieldName is null', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        act(() => {
            result.current.handleChange('email', 'valid@example.com');
        });
        expect(result.current.errors.email).toBeNull();
    });

    it('isValid is false when any field has a non-empty error array', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        act(() => {
            result.current.handleChange('email', 'bad-email');
            result.current.handleChange('name', 'Alice');
        });
        expect(result.current.isValid).toBe(false);
    });

    it('isValid is true when all errors are null', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'ok@example.com', name: 'Alice' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.isValid).toBe(true);
    });

    it('isValid is true when errors object is empty (no validations run yet)', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        expect(result.current.errors).toEqual({});
        expect(result.current.isValid).toBe(true);
    });

    it('error array contains the validation message string', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        act(() => {
            result.current.handleChange('email', '');
        });
        const errs = result.current.errors.email as string[];
        expect(errs.length).toBeGreaterThan(0);
        expect(typeof errs[0]).toBe('string');
    });
});

describe('useValiValid — touchedFields', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('handleBlur adds field to touchedFields', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        act(() => {
            result.current.handleBlur('email');
        });
        expect(result.current.touchedFields.has('email')).toBe(true);
        expect(result.current.touchedFields.has('name')).toBe(false);
    });

    it('multiple handleBlur calls on same field do not duplicate entries in Set', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        act(() => {
            result.current.handleBlur('email');
            result.current.handleBlur('email');
            result.current.handleBlur('email');
        });
        expect(result.current.touchedFields.size).toBe(1);
    });

    it('blurring multiple different fields adds all to touchedFields', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        act(() => {
            result.current.handleBlur('email');
            result.current.handleBlur('name');
        });
        expect(result.current.touchedFields.has('email')).toBe(true);
        expect(result.current.touchedFields.has('name')).toBe(true);
        expect(result.current.touchedFields.size).toBe(2);
    });

    it('reset() clears touchedFields', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        act(() => {
            result.current.handleBlur('email');
        });
        expect(result.current.touchedFields.size).toBe(1);
        act(() => {
            result.current.reset();
        });
        expect(result.current.touchedFields.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// v4 hook improvements
// ---------------------------------------------------------------------------

describe('v4 hook improvements', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.MinLength, value: 5 } as ValidationsConfig] },
    ];

    it('validateOnMount: true populates errors after mount', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations, validateOnMount: true })
        );
        // wait for the effect to run and validate
        await act(async () => {
            // flush effects
            await Promise.resolve();
        });
        // After validateOnMount, errors should be populated (arrays for invalid fields)
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    it('criteriaMode: firstError returns only first error per field', async () => {
        const { result } = renderHook(() =>
            useValiValid({
                initial: { email: '', name: '' },
                validations,
                criteriaMode: 'firstError',
            })
        );
        await act(async () => {
            await result.current.validate();
        });
        // required + email on empty string → at most 1 error
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBe(1);
    });

    it('criteriaMode: all (default) returns all errors per field', async () => {
        const { result } = renderHook(() =>
            useValiValid({
                initial: { email: '', name: '' },
                validations,
                criteriaMode: 'all',
            })
        );
        await act(async () => {
            await result.current.validate();
        });
        // required + email (or required + minLength) on empty string → 2 errors
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBeGreaterThanOrEqual(2);
    });

    it('trigger(field) validates a specific field and returns FormErrors', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('email');
        });
        expect(returned).toBeDefined();
        expect('email' in returned).toBe(true);
        expect(Array.isArray(returned.email)).toBe(true);
    });

    it('trigger() with no arg validates all fields', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger();
        });
        expect(returned).toBeDefined();
        expect('email' in returned).toBe(true);
        expect('name' in returned).toBe(true);
        expect(Array.isArray(returned.email)).toBe(true);
        expect(Array.isArray(returned.name)).toBe(true);
    });

    it('clearErrors(field) sets that field to null', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        // First trigger an error
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);

        // Now clear just the email error
        act(() => {
            result.current.clearErrors('email');
        });
        expect(result.current.errors.email).toBeNull();
        // name error should still be present
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    it('clearErrors() clears all errors to empty object', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);

        act(() => {
            result.current.clearErrors();
        });
        expect(result.current.errors).toEqual({});
        expect(result.current.isValid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// trigger() exhaustive tests
// ---------------------------------------------------------------------------

describe('useValiValid — trigger()', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('trigger(field) on empty required field → errors.field is a non-null array', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        await act(async () => {
            await result.current.trigger('email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBeGreaterThan(0);
    });

    it('trigger(field) on valid field value → errors.field is null', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'valid@example.com' }, validations })
        );
        await act(async () => {
            await result.current.trigger('email');
        });
        expect(result.current.errors.email).toBeNull();
    });

    it('trigger(field) returns object containing the triggered field key', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('email');
        });
        expect(returned).toBeDefined();
        expect(typeof returned).toBe('object');
        expect('email' in returned).toBe(true);
    });

    it('trigger(field) with two fields: only targeted field errors are updated', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        // First set a known state: validate all so name has errors too
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.name)).toBe(true);

        // Clear just email error manually to verify trigger only updates email
        act(() => {
            result.current.clearErrors('email');
        });
        expect(result.current.errors.email).toBeNull();

        // Now trigger email — only email should get errors, name stays as-is
        await act(async () => {
            await result.current.trigger('email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        // name was already an array of errors and should remain unchanged
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    it('trigger() no-arg validates all fields and errors has entries for each', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.trigger();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    it('trigger() no-arg returns FormErrors with all field keys', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger();
        });
        expect('email' in returned).toBe(true);
        expect('name' in returned).toBe(true);
    });

    it('calling trigger(field) twice consistently returns the same result', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'bad-email' }, validations })
        );
        let first: any;
        let second: any;
        await act(async () => {
            first = await result.current.trigger('email');
        });
        await act(async () => {
            second = await result.current.trigger('email');
        });
        expect(first.email).toEqual(second.email);
    });

    it('trigger(field) on field not in validations → returned errors do not crash and unknown key is absent or undefined', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        let returned: any;
        // 'unknown' is not in validations — should not throw
        await expect(act(async () => {
            returned = await result.current.trigger('unknown' as any);
        })).resolves.not.toThrow();
        // The unknown key should be absent from errors (null or undefined, not an error array)
        const unknownErr = returned?.unknown;
        expect(unknownErr === undefined || unknownErr === null).toBe(true);
    });

    it('trigger with async validator: after await, errors reflect async result', async () => {
        const asyncValidation: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: (_value: any, _form: any) => Promise.resolve(false),
            message: 'async error',
        } as any;
        const asyncValidations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [asyncValidation] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'anything' }, validations: asyncValidations })
        );
        await act(async () => {
            await result.current.trigger('email');
        });
        // After await, errors should reflect the async result (non-null)
        expect(result.current.errors.email).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// clearErrors() exhaustive tests
// ---------------------------------------------------------------------------

describe('useValiValid — clearErrors()', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('clearErrors(field) sets that field error to null', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        act(() => {
            result.current.clearErrors('email');
        });
        expect(result.current.errors.email).toBeNull();
    });

    it('clearErrors(field) with two fields → only targeted field cleared, other unchanged', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);
        act(() => {
            result.current.clearErrors('email');
        });
        expect(result.current.errors.email).toBeNull();
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    it('clearErrors() no-arg resets errors to empty object', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        act(() => {
            result.current.clearErrors();
        });
        expect(result.current.errors).toEqual({});
    });

    it('clearErrors() after validate() populated errors → all cleared', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);
        act(() => {
            result.current.clearErrors();
        });
        // After clearing, no field should have an error array
        expect(result.current.errors.email).toBeUndefined();
        expect(result.current.errors.name).toBeUndefined();
    });

    it('clearErrors(field) then trigger(field) on invalid → error comes back', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        act(() => {
            result.current.clearErrors('email');
        });
        expect(result.current.errors.email).toBeNull();
        await act(async () => {
            await result.current.trigger('email');
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
    });

    it('after clearErrors() all null/absent → isValid is true', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.isValid).toBe(false);
        act(() => {
            result.current.clearErrors();
        });
        expect(result.current.isValid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// criteriaMode exhaustive tests
// ---------------------------------------------------------------------------

describe('useValiValid — criteriaMode: firstError', () => {
    it('criteriaMode: firstError → errors.field array has exactly 1 entry when multiple rules fail', async () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, criteriaMode: 'firstError' })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBe(1);
    });

    it('criteriaMode: all (default) → errors.field array has entries for all failing rules', async () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, criteriaMode: 'all' })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBeGreaterThanOrEqual(2);
    });

    it('criteriaMode: firstError + required passes + email fails → 1 error for email rule', async () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        ];
        // 'not-an-email' passes Required but fails Email
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'not-an-email' }, validations, criteriaMode: 'firstError' })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBe(1);
    });

    it('criteriaMode: firstError + all rules pass → errors.field is null', async () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'valid@example.com' }, validations, criteriaMode: 'firstError' })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.errors.email).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// validateOnMount exhaustive tests
// ---------------------------------------------------------------------------

describe('useValiValid — validateOnMount', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
    ];

    it('validateOnMount: true + required field empty → errors populated after mount', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnMount: true })
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect((result.current.errors.email as string[]).length).toBeGreaterThan(0);
    });

    it('validateOnMount: false (default) → errors is empty after mount', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnMount: false })
        );
        expect(result.current.errors).toEqual({});
    });

    it('validateOnMount: true + valid initial value → errors.field is null after mount', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'valid@example.com' }, validations, validateOnMount: true })
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current.errors.email).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// isValidating tests
// ---------------------------------------------------------------------------

describe('useValiValid — isValidating', () => {
    it('isValidating is false initially before any validation', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations: [] })
        );
        expect(result.current.isValidating).toBe(false);
    });

    it('isValidating becomes false after validate() resolves', async () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        await act(async () => {
            await result.current.validate();
        });
        expect(result.current.isValidating).toBe(false);
    });
});

describe('useValiValid — watchFields / cross-field re-validation', () => {
    it('when field A watches field B, changing B re-validates A', () => {
        type Form = { password: string; confirm: string };
        // 'confirm' must match 'password'; it declares watchFields: ['password']
        // so when 'password' changes, 'confirm' is re-validated
        const validations: FieldValidationConfig<Form>[] = [
            {
                field: 'confirm',
                validations: [{ type: ValidationType.MatchField, field: 'password' } as ValidationsConfig],
                watchFields: ['password'],
            },
        ];

        const { result } = renderHook(() =>
            useValiValid<Form>({ initial: { password: '', confirm: 'abc' }, validations })
        );

        // Set confirm first
        act(() => {
            result.current.handleChange('confirm', 'abc');
        });

        // Now change password to something different — confirm should become invalid
        act(() => {
            result.current.handleChange('password', 'xyz');
        });

        expect(Array.isArray(result.current.errors.confirm)).toBe(true);
    });

    it('when field A watches field B, matching B makes A valid', () => {
        type Form = { password: string; confirm: string };
        const validations: FieldValidationConfig<Form>[] = [
            {
                field: 'confirm',
                validations: [{ type: ValidationType.MatchField, field: 'password' } as ValidationsConfig],
                watchFields: ['password'],
            },
        ];

        const { result } = renderHook(() =>
            useValiValid<Form>({ initial: { password: 'abc', confirm: 'abc' }, validations })
        );

        // Both match initially — trigger validate
        act(() => {
            result.current.handleChange('confirm', 'abc');
        });
        act(() => {
            result.current.handleChange('password', 'abc');
        });

        expect(result.current.errors.confirm).toBeNull();
    });

    it('RequiredIf cross-field validation detects invalid state via validate()', async () => {
        type Form = { hasDiscount: string; coupon: string };
        const validations: FieldValidationConfig<Form>[] = [
            {
                field: 'coupon',
                validations: [
                    {
                        type: ValidationType.RequiredIf,
                        condition: (form: Form) => form.hasDiscount === 'yes',
                    } as ValidationsConfig,
                ],
                watchFields: ['hasDiscount'],
            },
        ];

        const { result } = renderHook(() =>
            useValiValid<Form>({ initial: { hasDiscount: 'yes', coupon: '' }, validations })
        );

        // Validate with hasDiscount='yes' and coupon='' — coupon is required and missing
        await act(async () => {
            await result.current.validate();
        });
        expect(Array.isArray(result.current.errors.coupon)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Additional reset() coverage
// ---------------------------------------------------------------------------

describe('useValiValid — reset() additional coverage', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('reset(newInitial) → field whose value equals new initial is NOT dirty after reset', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        // Dirty the email field first
        act(() => {
            result.current.handleChange('email', 'dirty@example.com');
        });
        expect(result.current.dirtyFields.has('email')).toBe(true);

        // Reset with a newInitial — the new form value for email becomes 'reset@example.com'
        // so email is now exactly equal to the new baseline → NOT dirty
        act(() => {
            result.current.reset({ email: 'reset@example.com' });
        });
        expect(result.current.dirtyFields.has('email')).toBe(false);
        expect(result.current.form.email).toBe('reset@example.com');
    });

    it('reset(newInitial) → field that differs from new initial IS dirty after reset + change', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        act(() => {
            result.current.reset({ email: 'base@example.com' });
        });
        // Change to something different from the new baseline
        act(() => {
            result.current.handleChange('email', 'different@example.com');
        });
        expect(result.current.dirtyFields.has('email')).toBe(true);
    });

    it('reset() with no args → returns to the original initial, not the last reset target', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'original@example.com', name: '' }, validations })
        );
        // First reset to a new baseline
        act(() => {
            result.current.reset({ email: 'intermediate@example.com' });
        });
        expect(result.current.form.email).toBe('intermediate@example.com');

        // Bare reset() should return to the constructor's initial, not 'intermediate@example.com'
        act(() => {
            result.current.reset();
        });
        expect(result.current.form.email).toBe('original@example.com');
    });

    it('deepClone in reset: mutating nested object in form state does not corrupt reset() target', () => {
        type ComplexForm = { tags: string[]; meta: { count: number } };
        const initial: ComplexForm = { tags: ['a', 'b'], meta: { count: 0 } };
        const { result } = renderHook(() =>
            useValiValid<ComplexForm>({ initial, validations: [] })
        );

        // Mutate the form state by pushing an element into the tags array via setValues
        act(() => {
            result.current.setValues({ tags: ['a', 'b', 'c'], meta: { count: 99 } });
        });
        expect((result.current.form.tags as string[]).length).toBe(3);
        expect((result.current.form.meta as { count: number }).count).toBe(99);

        // After bare reset(), form should be back to the original initial
        act(() => {
            result.current.reset();
        });
        expect(result.current.form.tags).toEqual(['a', 'b']);
        expect((result.current.form.meta as { count: number }).count).toBe(0);
    });

    it('reset() while handleSubmit is in progress → clears submitting state so next submit works', async () => {
        const onSubmit = vi.fn();
        let resolveSubmit!: () => void;
        const slowSubmit = () =>
            new Promise<void>((resolve) => {
                resolveSubmit = resolve;
            });

        const { result } = renderHook(() =>
            useValiValid({
                initial: { email: 'valid@example.com', name: 'Alice' },
                validations,
            })
        );

        // Start a submit that hangs
        const submitPromise = act(async () => {
            void result.current.handleSubmit(slowSubmit)();
        });

        // While submit is in flight, call reset()
        act(() => {
            result.current.reset();
        });

        // Resolve the hanging submit so it doesn't leak
        if (resolveSubmit) resolveSubmit();
        await submitPromise;

        // After reset, errors and state are clean
        expect(result.current.errors).toEqual({});
        expect(result.current.isSubmitted).toBe(false);

        // The next submit should work without being blocked by _isSubmitting
        await act(async () => {
            await result.current.handleSubmit(onSubmit)();
        });
        expect(onSubmit).toHaveBeenCalledWith({ email: 'valid@example.com', name: 'Alice' });
    });
});

// ---------------------------------------------------------------------------
// Additional criteriaMode coverage
// ---------------------------------------------------------------------------

describe('useValiValid — criteriaMode additional', () => {
    const multiValidations: FieldValidationConfig<any>[] = [
        {
            field: 'name',
            validations: [
                { type: ValidationType.Required } as ValidationsConfig,
                { type: ValidationType.MinLength, value: 5 } as ValidationsConfig,
                { type: ValidationType.Alpha } as ValidationsConfig,
            ],
        },
    ];

    it('criteriaMode: firstError with multiple failing rules → only 1 error via handleChange', () => {
        const { result } = renderHook(() =>
            useValiValid({
                initial: { name: '' },
                validations: multiValidations,
                criteriaMode: 'firstError',
            })
        );
        act(() => {
            result.current.handleChange('name', '');
        });
        expect(Array.isArray(result.current.errors.name)).toBe(true);
        expect((result.current.errors.name as string[]).length).toBe(1);
    });

    it('criteriaMode: all with multiple failing rules → all errors via handleChange', () => {
        const { result } = renderHook(() =>
            useValiValid({
                initial: { name: '' },
                validations: multiValidations,
                criteriaMode: 'all',
            })
        );
        act(() => {
            result.current.handleChange('name', '');
        });
        expect(Array.isArray(result.current.errors.name)).toBe(true);
        // required + minLength + alpha all fail on empty → at least 2
        expect((result.current.errors.name as string[]).length).toBeGreaterThanOrEqual(2);
    });
});

// ---------------------------------------------------------------------------
// Additional validateOnMount coverage
// ---------------------------------------------------------------------------

describe('useValiValid — validateOnMount additional', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
    ];

    it('validateOnMount: true → errors are non-null immediately after mount microtask flush', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnMount: true })
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current.errors.email).not.toBeNull();
        expect(Array.isArray(result.current.errors.email)).toBe(true);
    });

    it('validateOnMount: true → isValid is false when initial values are invalid', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations, validateOnMount: true })
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current.isValid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// asyncTimeout non-blocking test
// ---------------------------------------------------------------------------

describe('useValiValid — asyncTimeout non-blocking', () => {
    it('async validator taking longer than asyncTimeout does not block form interaction', async () => {
        vi.useFakeTimers();
        const slowAsync: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 300)),
            message: 'slow check',
        } as any;
        const { result } = renderHook(() =>
            useValiValid({
                initial: { email: 'test@example.com' },
                validations: [{ field: 'email', validations: [slowAsync] }],
                asyncTimeout: 100,
                debounceMs: 0,
            })
        );

        act(() => {
            result.current.handleChange('email', 'test@example.com');
        });
        // Advance past debounce and into async execution
        await act(async () => { vi.advanceTimersByTime(1); });
        // Advance past asyncTimeout (100ms) so _withTimeout rejects — form must not hang
        await act(async () => { vi.advanceTimersByTime(150); });

        // isValidating should be false (finally block ran after timeout rejection)
        expect(result.current.isValidating).toBe(false);
        // The user can still interact with the form normally
        act(() => {
            result.current.handleChange('email', 'other@example.com');
        });
        expect(result.current.form.email).toBe('other@example.com');

        vi.useRealTimers();
    }, 5000);
});

// ---------------------------------------------------------------------------
// trigger() + clearErrors() — new targeted coverage
// ---------------------------------------------------------------------------

describe('useValiValid — trigger() targeted coverage', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
    ];

    it('trigger() with no field arg → validates all fields and returns FormErrors with all keys', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger();
        });
        expect('email' in returned).toBe(true);
        expect('name' in returned).toBe(true);
        expect(Array.isArray(returned.email)).toBe(true);
        expect(Array.isArray(returned.name)).toBe(true);
    });

    it('trigger(field) returns errors containing only that specific field key', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('email');
        });
        expect('email' in returned).toBe(true);
        expect(Array.isArray(returned.email)).toBe(true);
        // name was not triggered — should remain undefined in errors
        expect(result.current.errors.name).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// New targeted coverage: timer-leak fix, locale forwarding, async + field mgmt
// ---------------------------------------------------------------------------

describe('useValiValid — new coverage: timer-leak, locale, async, field-management', () => {
    const baseValidations: FieldValidationConfig<any>[] = [
        {
            field: 'email',
            validations: [
                { type: ValidationType.Required } as ValidationsConfig,
                { type: ValidationType.Email } as ValidationsConfig,
            ],
        },
        {
            field: 'name',
            validations: [{ type: ValidationType.Required } as ValidationsConfig],
        },
    ];

    // 1. trigger() with no field arg → validates all fields
    it('trigger() with no field arg populates all fields in FormErrors', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations: baseValidations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger();
        });
        expect('email' in returned).toBe(true);
        expect('name' in returned).toBe(true);
        expect(Array.isArray(returned.email)).toBe(true);
        expect(Array.isArray(returned.name)).toBe(true);
    });

    // 2. trigger(field) → returns errors for that field only
    it('trigger(field) returns errors only for the specified field', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations: baseValidations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('email');
        });
        expect('email' in returned).toBe(true);
        expect(Array.isArray(returned.email)).toBe(true);
        // name was not triggered
        expect(result.current.errors.name).toBeUndefined();
    });

    // 3. clearErrors(field) → clears only that field's errors, leaves others
    it('clearErrors(field) clears only that field leaving others intact', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations: baseValidations })
        );
        await act(async () => { await result.current.validate(); });
        expect(Array.isArray(result.current.errors.email)).toBe(true);
        expect(Array.isArray(result.current.errors.name)).toBe(true);

        act(() => { result.current.clearErrors('email'); });
        expect(result.current.errors.email).toBeNull();
        expect(Array.isArray(result.current.errors.name)).toBe(true);
    });

    // 4. clearErrors() no arg → clears all errors
    it('clearErrors() with no arg resets errors to empty object', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '', name: '' }, validations: baseValidations })
        );
        await act(async () => { await result.current.validate(); });
        expect(Array.isArray(result.current.errors.email)).toBe(true);

        act(() => { result.current.clearErrors(); });
        expect(result.current.errors).toEqual({});
        expect(result.current.isValid).toBe(true);
    });

    // 5. addFieldValidation + validate() enforces the new rule
    it('addFieldValidation(field, config) — next validate() enforces the added rule', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { code: 'hello' }, validations: [] })
        );
        // Initially no rules — handleChange produces null (valid)
        act(() => { result.current.handleChange('code', 'hello'); });
        expect(result.current.errors.code).toBeNull();

        // Add a DigitsOnly rule
        act(() => {
            result.current.addFieldValidation('code', [
                { type: ValidationType.DigitsOnly } as ValidationsConfig,
            ]);
        });
        // handleChange again — 'hello' violates DigitsOnly
        act(() => { result.current.handleChange('code', 'hello'); });
        expect(Array.isArray(result.current.errors.code)).toBe(true);
    });

    // 6. removeFieldValidation removes a specific rule
    it('removeFieldValidation(field, type) — rule removed; validate() no longer enforces it', async () => {
        const validationsWithDigits: FieldValidationConfig<any>[] = [
            { field: 'code', validations: [{ type: ValidationType.DigitsOnly } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { code: 'abc' }, validations: validationsWithDigits })
        );
        // First, verify rule is active
        await act(async () => { await result.current.validate(); });
        expect(Array.isArray(result.current.errors.code)).toBe(true);

        // Remove the DigitsOnly rule
        act(() => {
            result.current.removeFieldValidation('code', ValidationType.DigitsOnly);
        });
        await act(async () => { await result.current.validate(); });
        expect(result.current.errors.code).toBeNull();
    });

    // 7. locale: 'es' → error messages are in Spanish
    it("locale: 'es' produces Spanish error messages", async () => {
        const { result } = renderHook(() =>
            useValiValid({
                initial: { email: '' },
                validations: [
                    { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
                ],
                locale: 'es',
            })
        );
        await act(async () => { await result.current.validate(); });
        const msgs = result.current.errors.email as string[];
        expect(Array.isArray(msgs)).toBe(true);
        // Spanish required message contains 'obligatorio'
        expect(msgs.some((m) => m.includes('obligatorio'))).toBe(true);
    });

    // 8. asyncTimeout: 100 with slow async validator — form doesn't block
    it('asyncTimeout:100 with slow async validator does not block the form', async () => {
        vi.useFakeTimers();
        const slowAsync: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
            message: 'slow error',
        } as any;
        const { result } = renderHook(() =>
            useValiValid({
                initial: { username: 'test' },
                validations: [{ field: 'username', validations: [slowAsync] }],
                asyncTimeout: 100,
                debounceMs: 0,
            })
        );
        act(() => { result.current.handleChange('username', 'test'); });
        // Advance past debounce (0) to fire the timer callback
        await act(async () => { vi.advanceTimersByTime(1); });
        // Advance past asyncTimeout (100ms) so _withTimeout rejects first
        await act(async () => { vi.advanceTimersByTime(200); });
        // isValidating must be false — finally block ran after timeout
        expect(result.current.isValidating).toBe(false);
        // The form is still usable
        act(() => { result.current.handleChange('username', 'other'); });
        expect(result.current.form.username).toBe('other');
        vi.useRealTimers();
    });
});

describe('useValiValid — asyncTimeout option', () => {
    it('rejects async validator that never resolves after asyncTimeout ms', async () => {
        vi.useFakeTimers();
        const neverResolves: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: () => new Promise(() => {}), // never resolves
            message: 'timeout error',
        } as any;
        const { result } = renderHook(() =>
            useValiValid({
                initial: { field: 'value' },
                validations: [{ field: 'field', validations: [neverResolves] }],
                asyncTimeout: 200, // 200ms timeout for fast test
            })
        );
        // Trigger handleChange so the async validator starts (runs via _withTimeout + asyncTimeout)
        act(() => {
            result.current.handleChange('field', 'new-value');
        });
        // The hook should now be in validating state (timer pending, async in flight)
        expect(result.current.isValidating).toBe(true);
        // Advance timers past debounce (0ms default) so the async rule fires
        await act(async () => {
            vi.advanceTimersByTime(1);
        });
        // Now advance past the asyncTimeout (200ms) so _withTimeout rejects
        await act(async () => {
            vi.advanceTimersByTime(300);
        });
        // After timeout rejection, isValidating should be false (finally block ran)
        expect(result.current.isValidating).toBe(false);
        vi.useRealTimers();
    });
});

describe('useValiValid — gap coverage', () => {
    const validations: FieldValidationConfig<any>[] = [
        { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        { field: 'name', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.MinLength, value: 3 } as ValidationsConfig] },
    ];

    describe('getValues', () => {
        it('returns current form values as a plain object', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: 'a@b.com', name: 'Alice' }, validations })
            );
            act(() => {
                result.current.handleChange('name', 'Bob');
            });
            const values = result.current.getValues();
            expect(values.name).toBe('Bob');
            expect(values.email).toBe('a@b.com');
        });

        it('returned object is a deep clone — mutating it does not affect internal state', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: 'a@b.com', name: 'Alice' }, validations })
            );
            const values = result.current.getValues();
            values.email = 'mutated@example.com';
            expect(result.current.form.email).toBe('a@b.com');
        });
    });

    describe('clearErrors', () => {
        it('clearErrors() with no arg clears all fields to an empty object', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            await act(async () => { await result.current.validate(); });
            // errors should be populated
            expect(Array.isArray(result.current.errors.email)).toBe(true);
            act(() => { result.current.clearErrors(); });
            expect(result.current.errors).toEqual({});
        });

        it('clearErrors(field) clears only that field and leaves others intact', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '', name: '' }, validations })
            );
            await act(async () => { await result.current.validate(); });
            expect(Array.isArray(result.current.errors.email)).toBe(true);
            expect(Array.isArray(result.current.errors.name)).toBe(true);
            act(() => { result.current.clearErrors('email'); });
            expect(result.current.errors.email).toBeNull();
            expect(Array.isArray(result.current.errors.name)).toBe(true);
        });
    });

    describe('setFieldValidations', () => {
        it('replaces rules — next validate enforces new rules only', async () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: '' }, validations })
            );
            // Replace email validation with just Required (no Email format check)
            act(() => {
                result.current.setFieldValidations('email', [
                    { type: ValidationType.Required } as ValidationsConfig,
                ]);
            });
            // Set a non-empty but invalid-format email — should now be valid since Email rule removed
            act(() => { result.current.handleChange('email', 'not-an-email'); });
            await act(async () => { await result.current.validate(); });
            expect(result.current.errors.email).toBeNull();
        });
    });

    describe('validateOnMount', () => {
        it('validateOnMount: true with initially-invalid form populates errors after mount', async () => {
            let hookResult: any;
            await act(async () => {
                const { result } = renderHook(() =>
                    useValiValid({
                        initial: { email: '', name: '' },
                        validations,
                        validateOnMount: true,
                    })
                );
                hookResult = result;
            });
            expect(Array.isArray(hookResult.current.errors.email) || Array.isArray(hookResult.current.errors.name)).toBe(true);
        });
    });

    describe('getValues', () => {
        it('returns an object that equals the current form state', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: 'test@example.com', name: 'Alice' }, validations })
            );
            const values = result.current.getValues();
            expect(values).toEqual(result.current.form);
        });

        it('mutating the returned object does NOT affect the internal form state (deep clone guarantee)', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: 'test@example.com', name: 'Alice' }, validations })
            );
            const values = result.current.getValues();
            values.email = 'mutated@example.com';
            expect(result.current.form.email).toBe('test@example.com');
            expect(result.current.getValues().email).toBe('test@example.com');
        });

        it('after reset(newInitial) returns the new initial values, not the old ones', () => {
            const { result } = renderHook(() =>
                useValiValid({ initial: { email: 'old@example.com', name: 'Old' }, validations })
            );
            act(() => {
                result.current.reset({ email: 'new@example.com', name: 'New' });
            });
            const values = result.current.getValues();
            expect(values.email).toBe('new@example.com');
            expect(values.name).toBe('New');
        });
    });
});

// ---------------------------------------------------------------------------
// New targeted coverage: validateOnMount + trigger() async path
// ---------------------------------------------------------------------------

describe('useValiValid — validateOnMount and trigger() async path', () => {
    // -----------------------------------------------------------------------
    // Group A: validateOnMount
    // -----------------------------------------------------------------------

    it('validateOnMount:true with invalid initial form → errors has entries (not all null/undefined) after mount', async () => {
        // Two fields both empty and required — both should surface errors
        const validations: FieldValidationConfig<any>[] = [
            { field: 'username', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
            { field: 'password', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.MinLength, value: 8 } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { username: '', password: '' }, validations, validateOnMount: true })
        );
        // Flush the mount effect and the async validate() call it triggers
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve(); // second tick ensures async resolves from validate()
        });
        const errValues = Object.values(result.current.errors);
        const hasNonNullEntry = errValues.some((e) => e !== null && e !== undefined && !(Array.isArray(e) && e.length === 0));
        expect(hasNonNullEntry).toBe(true);
    });

    it('validateOnMount:true with valid initial form → isValid is true after mount', async () => {
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig, { type: ValidationType.Email } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: 'user@example.com' }, validations, validateOnMount: true })
        );
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(result.current.isValid).toBe(true);
    });

    it('validateOnMount not set (default) → errors object remains empty {} after mount', async () => {
        // validateOnMount is intentionally omitted — should default to false
        const validations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { email: '' }, validations })
        );
        // Even after a microtask tick no validation should have fired
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current.errors).toEqual({});
    });

    // -----------------------------------------------------------------------
    // Group B: trigger(field) async path
    // -----------------------------------------------------------------------

    it('trigger(field) with async validator that resolves false → errors contain the rule message', async () => {
        const ASYNC_MSG = 'username already taken';
        const asyncValidation: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: (_value: any, _form: any) => Promise.resolve(false),
            message: ASYNC_MSG,
        } as any;
        const asyncValidations: FieldValidationConfig<any>[] = [
            { field: 'username', validations: [asyncValidation] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { username: 'taken' }, validations: asyncValidations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('username');
        });
        // The returned errors object must have the field key with an error array containing the message
        expect(Array.isArray(returned.username)).toBe(true);
        expect((returned.username as string[]).some((m: string) => m === ASYNC_MSG)).toBe(true);
        // Hook state should also reflect the error
        expect(Array.isArray(result.current.errors.username)).toBe(true);
    });

    it('trigger(field) with async validator that resolves true → field error is null', async () => {
        const asyncValidation: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: (_value: any, _form: any) => Promise.resolve(true),
            message: 'should not appear',
        } as any;
        const asyncValidations: FieldValidationConfig<any>[] = [
            { field: 'username', validations: [asyncValidation] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { username: 'available' }, validations: asyncValidations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('username');
        });
        // Async validator passed → error for the field should be null
        expect(returned.username).toBeNull();
        expect(result.current.errors.username).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// New targeted coverage: trigger() sync-only branch + post-unmount epoch sentinel
// ---------------------------------------------------------------------------

describe('useValiValid — trigger() sync-only branch and post-unmount epoch sentinel', () => {
    // -----------------------------------------------------------------------
    // Group C: trigger(field) sync-only branch
    // -----------------------------------------------------------------------

    it('trigger(field) with sync-only validators returns sync errors for an invalid field', async () => {
        // Field has only a Required validator (sync). Empty value should produce an error.
        const syncValidations: FieldValidationConfig<any>[] = [
            { field: 'title', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { title: '' }, validations: syncValidations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('title');
        });
        // trigger() is async but follows the sync-only branch (no hasAsyncRules)
        expect(Array.isArray(returned.title)).toBe(true);
        expect((returned.title as string[]).length).toBeGreaterThan(0);
        // Hook state should also reflect the error
        expect(Array.isArray(result.current.errors.title)).toBe(true);
    });

    it('trigger(field) with sync-only validators returns null when the field is valid', async () => {
        // Field has only a MinLength validator and the value satisfies it.
        const syncValidations: FieldValidationConfig<any>[] = [
            {
                field: 'title',
                validations: [
                    { type: ValidationType.Required } as ValidationsConfig,
                    { type: ValidationType.MinLength, value: 3 } as ValidationsConfig,
                ],
            },
        ];
        const { result } = renderHook(() =>
            useValiValid({ initial: { title: 'Hello' }, validations: syncValidations })
        );
        let returned: any;
        await act(async () => {
            returned = await result.current.trigger('title');
        });
        // All sync validators pass → error should be null
        expect(returned.title).toBeNull();
        expect(result.current.errors.title).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Group D: post-unmount epoch sentinel (-1)
    // -----------------------------------------------------------------------

    it('async validation completing after unmount does NOT update errors state', async () => {
        // Arrange: an async validator that we can resolve manually after unmount.
        let resolveAsync!: (value: boolean) => void;
        const slowAsyncValidation: ValidationsConfig = {
            type: ValidationType.AsyncPattern,
            asyncFn: (_value: any, _form: any) =>
                new Promise<boolean>((resolve) => { resolveAsync = resolve; }),
            message: 'slow error',
        } as any;
        const asyncValidations: FieldValidationConfig<any>[] = [
            { field: 'username', validations: [slowAsyncValidation] },
        ];

        const { result, unmount } = renderHook(() =>
            useValiValid({ initial: { username: 'test' }, validations: asyncValidations })
        );

        // Start an async trigger — it will not resolve until we call resolveAsync()
        let triggerPromise: Promise<any>;
        act(() => {
            triggerPromise = result.current.trigger('username');
        });

        // Capture errors state before unmount (should still be initial empty {})
        const errorsBeforeUnmount = result.current.errors;

        // Unmount sets _epochRef.current = -1 (sentinel)
        act(() => {
            unmount();
        });

        // Now resolve the slow async validator AFTER unmount
        await act(async () => {
            resolveAsync(false); // would produce an error if epoch were still valid
            await triggerPromise;
        });

        // The errors should not have changed from before unmount because the
        // epoch sentinel (-1) causes the stale check to silently discard the result.
        expect(result.current.errors).toEqual(errorsBeforeUnmount);
    });
});

// ---------------------------------------------------------------------------
// validateOnMount + reset() in the same render cycle
// ---------------------------------------------------------------------------

describe('useValiValid — validateOnMount with reset() in same render cycle', () => {
    // React's useEffect fires synchronously inside renderHook's internal act(). The mount
    // effect calls validate(), which is async — it increments _epochRef and captures epoch N.
    // If reset() is then called (in the same "render cycle" from the test perspective),
    // reset() increments _epochRef to N+1. When validate()'s async work settles, the stale
    // check sees _epochRef !== epoch and discards the result. Errors stay {}.
    // This is analogous to Vue's epoch guard behaviour: reset() before/during mount validation
    // invalidates the in-progress validate() call. The mechanism differs (React uses the
    // _epochRef stale check rather than a mountEpoch variable), but the outcome is the same.
    it('validateOnMount: true + reset() called immediately after mount → errors remain empty (stale epoch check)', async () => {
        const mountValidations: FieldValidationConfig<any>[] = [
            { field: 'email', validations: [{ type: ValidationType.Required } as ValidationsConfig] },
        ];

        // renderHook flushes mount effects synchronously inside its own act().
        // The validateOnMount useEffect fires and calls validate(), capturing the current epoch.
        const { result } = renderHook(() =>
            useValiValid({
                initial: { email: '' },
                validations: mountValidations,
                validateOnMount: true,
            })
        );

        // reset() increments _epochRef — this invalidates the in-progress validate() that
        // was started by the mount effect. When validate()'s async work resolves, the stale
        // check (_epochRef !== epoch) discards the result.
        act(() => {
            result.current.reset();
        });

        // Flush any remaining async work from validate()
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        // The in-progress validateOnMount was epoch-invalidated by reset() → errors stay {}.
        // This matches the Vue epoch guard outcome (same net effect, different mechanism).
        expect(Object.keys(result.current.errors).length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// isSubmitting
// ---------------------------------------------------------------------------

describe('isSubmitting', () => {
    it('is false before any submit', () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { name: '' } })
        );
        expect(result.current.isSubmitting).toBe(false);
    });

    it('is true while handleSubmit is executing a slow onSubmit callback', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { name: 'Alice' } })
        );

        let resolveSubmit!: () => void;
        const slowSubmit = () =>
            new Promise<void>((resolve) => { resolveSubmit = resolve; });

        // Start the submit but don't await it yet
        let submitPromise: Promise<void>;
        act(() => {
            submitPromise = result.current.handleSubmit(slowSubmit)();
        });

        // Flush microtasks so handleSubmit reaches the onSubmit call
        await act(async () => { await Promise.resolve(); });

        expect(result.current.isSubmitting).toBe(true);

        // Resolve the slow callback and let handleSubmit finish
        await act(async () => {
            resolveSubmit();
            await submitPromise;
        });
    });

    it('is false after handleSubmit completes', async () => {
        const { result } = renderHook(() =>
            useValiValid({ initial: { name: 'Alice' } })
        );

        await act(async () => {
            await result.current.handleSubmit(() => Promise.resolve())();
        });

        expect(result.current.isSubmitting).toBe(false);
    });
});
