# vali-valid-react

React hook for [vali-valid](https://www.npmjs.com/package/vali-valid) — `useValiValid` with async validation, i18n, criteriaMode, and full TypeScript support.

[![npm](https://img.shields.io/npm/v/vali-valid-react)](https://www.npmjs.com/package/vali-valid-react)
[![license](https://img.shields.io/npm/l/vali-valid-react)](LICENSE)

---

## Installation

```bash
npm install vali-valid-react vali-valid
```

> **Note:** `vali-valid` must be version **≥ 3.1.0**.

---

## Quick start

```tsx
import { useValiValid } from 'vali-valid-react';
import { rule } from 'vali-valid';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginForm() {
  const { form, errors, handleChange, validate } = useValiValid<LoginForm>({
    initial: { email: '', password: '' },
    validations: [
      { field: 'email',    validations: rule().required().email().build() },
      { field: 'password', validations: rule().required().minLength(8).build() },
    ],
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await validate();
    if (result.isValid) {
      console.log('Submit:', form);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div>
        <input
          placeholder="Email"
          value={form.email}
          onChange={e => handleChange('email', e.target.value)}
        />
        {errors.email?.map(msg => <p key={msg} style={{ color: 'red' }}>{msg}</p>)}
      </div>

      <div>
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={e => handleChange('password', e.target.value)}
        />
        {errors.password?.map(msg => <p key={msg} style={{ color: 'red' }}>{msg}</p>)}
      </div>

      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Async validation

Use `rule().asyncPattern()` for server-side checks like username availability. The hook sets `isValidating` to `true` while the async rule is pending.

```tsx
import { useValiValid } from 'vali-valid-react';
import { rule } from 'vali-valid';

export default function RegisterForm() {
  const { form, errors, isValidating, handleChange, validate } = useValiValid({
    initial: { username: '', email: '', password: '' },
    validations: [
      {
        field: 'username',
        validations: rule()
          .required()
          .minLength(3)
          .maxLength(20)
          .asyncPattern(
            async (value) => {
              const res = await fetch(`/api/users/check?username=${value}`);
              const { available } = await res.json();
              return available; // true = valid, false = invalid
            },
            'Username is already taken.'
          )
          .build(),
      },
      { field: 'email',    validations: rule().required().email().build() },
      { field: 'password', validations: rule().required().minLength(8).passwordStrength().build() },
    ],
    debounceMs: 400, // debounce async validators to avoid a request per keystroke
  });

  return (
    <form onSubmit={async e => { e.preventDefault(); await validate(); }}>
      <div>
        <input
          placeholder="Username"
          value={form.username}
          onChange={e => handleChange('username', e.target.value)}
        />
        {isValidating && <span>Checking…</span>}
        {errors.username?.map(msg => <p key={msg} style={{ color: 'red' }}>{msg}</p>)}
      </div>
      {/* email and password fields… */}
      <button type="submit">Register</button>
    </form>
  );
}
```

---

## i18n — runtime locale switching

`vali-valid` ships with built-in error messages in **EN, ES, PT, FR and DE**. Call `setLocale()` from the core package and re-run `validate()` to update all messages instantly.

```tsx
import { useValiValid } from 'vali-valid-react';
import { rule, setLocale } from 'vali-valid';

const locales = ['en', 'es', 'pt', 'fr', 'de'] as const;

export default function I18nForm() {
  const [locale, setLocaleState] = React.useState('en');
  const { form, errors, handleChange, validate } = useValiValid({
    initial: { name: '', email: '' },
    validations: [
      { field: 'name',  validations: rule().required().minLength(3).build() },
      { field: 'email', validations: rule().required().email().build() },
    ],
  });

  const switchLocale = async (l: string) => {
    setLocaleState(l);
    setLocale(l as any);
    await validate(); // re-validate so messages appear in the new language
  };

  return (
    <div>
      <div>
        {locales.map(l => (
          <button key={l} onClick={() => switchLocale(l)}
            style={{ fontWeight: locale === l ? 'bold' : 'normal' }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <input placeholder="Name" value={form.name} onChange={e => handleChange('name', e.target.value)} />
      {errors.name?.map(msg => <p key={msg}>{msg}</p>)}

      <input placeholder="Email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
      {errors.email?.map(msg => <p key={msg}>{msg}</p>)}

      <button onClick={() => validate()}>Validate ({locale.toUpperCase()})</button>
    </div>
  );
}
```

---

## criteriaMode

Control whether all failing rules are returned or only the first one per field.

```tsx
// Default: 'all' — all failing rules returned as string[]
// 'firstError' — only the first failing rule returned

const { errors } = useValiValid({
  initial: { password: '' },
  validations: [
    { field: 'password', validations: rule().required().minLength(8).passwordStrength().build() },
  ],
  criteriaMode: 'firstError', // stops at the first failing rule
});
```

---

## Server-side errors

After a form submission that returns a 422 from the API, merge server errors directly into the hook state:

```tsx
const { setServerErrors } = useValiValid({ ... });

const onSubmit = async () => {
  const res = await api.register(form);
  if (res.status === 422) {
    setServerErrors({
      email: ['Email is already in use.'],
      username: ['Username is reserved.'],
    });
  }
};
```

---

## Dynamic rules

Add, remove, or replace validation rules at runtime — useful for conditional fields:

```tsx
const { addFieldValidation, removeFieldValidation, clearFieldValidations } = useValiValid({ ... });

// show a coupon field only for 'pro' plan
if (plan === 'pro') {
  addFieldValidation('coupon', rule().required().minLength(4).build());
} else {
  clearFieldValidations('coupon');
}
```

---

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `initial` | `T` | required | Initial form values |
| `validations` | `FieldValidationConfig<T>[]` | `[]` | Validation rules per field |
| `locale` | `string` | global locale | Per-instance locale override (`'en'`, `'es'`, `'pt'`, `'fr'`, `'de'`) |
| `criteriaMode` | `'all' \| 'firstError'` | `'all'` | Return all errors or stop at first |
| `validateOnMount` | `boolean` | `false` | Run full validation immediately on mount |
| `validateOnBlur` | `boolean` | `false` | Validate a field when it loses focus |
| `validateOnSubmit` | `boolean` | `false` | Suppress per-keystroke validation until first submit |
| `debounceMs` | `number` | `0` | Debounce delay for async validators (ms) |
| `asyncTimeout` | `number` | `10000` | Timeout for async validators (ms) |

---

## Return value

| Property / Method | Type | Description |
|---|---|---|
| `form` | `T` | Current form values |
| `errors` | `Partial<Record<keyof T, string[]>>` | Current validation errors per field |
| `isValid` | `boolean` | `true` when there are no errors |
| `isValidating` | `boolean` | `true` while an async validator is running |
| `isSubmitted` | `boolean` | `true` after the first `validate()` call |
| `submitCount` | `number` | Number of times `validate()` has been called |
| `touchedFields` | `Partial<Record<keyof T, boolean>>` | Fields that have been interacted with |
| `dirtyFields` | `Partial<Record<keyof T, boolean>>` | Fields whose value differs from `initial` |
| `handleChange(field, value)` | `void` | Update a field value and trigger validation |
| `handleBlur(field)` | `void` | Mark a field as touched and trigger blur validation |
| `validate()` | `Promise<{ isValid: boolean; errors: … }>` | Validate the entire form |
| `trigger(field?)` | `Promise<void>` | Validate one field or the whole form |
| `reset(newInitial?)` | `void` | Reset form and errors to initial (or new) values |
| `setValues(values)` | `void` | Patch multiple field values without validation |
| `setServerErrors(errors)` | `void` | Merge server-side errors into the error state |
| `clearErrors(field?)` | `void` | Clear one field's error or all errors |
| `getValues()` | `T` | Snapshot of the current form values |
| `addFieldValidation(field, rules)` | `void` | Add validation rules to a field at runtime |
| `removeFieldValidation(field, type)` | `void` | Remove a specific rule type from a field |
| `setFieldValidations(field, rules)` | `void` | Replace all rules for a field |
| `clearFieldValidations(field)` | `void` | Remove all rules from a field |

---

## Requirements

| Peer dependency | Minimum version |
|---|---|
| `react` | `16.8.0` |
| `vali-valid` | `3.1.0` |

---

## Links

- [Documentation](https://vali-valid.dev/hook-api)
- [vali-valid core on npm](https://www.npmjs.com/package/vali-valid)
- [GitHub](https://github.com/UBF21/Vali-Valid-React)

---

## License

MIT
