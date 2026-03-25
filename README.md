# vali-valid-react

React hook for [vali-valid](https://www.npmjs.com/package/vali-valid).

## Installation

```bash
npm install vali-valid-react vali-valid
```

## Usage

```tsx
import { useValiValid } from 'vali-valid-react';
import { ValidationType } from 'vali-valid';

function MyForm() {
  const { values, errors, handleChange, handleSubmit } = useValiValid({
    initialValues: { email: '', password: '' },
    validationConfig: [
      { field: 'email', validations: [{ type: ValidationType.Required }, { type: ValidationType.Email }] },
      { field: 'password', validations: [{ type: ValidationType.Required }, { type: ValidationType.MinLength, value: 8 }] },
    ],
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input value={values.email} onChange={e => handleChange('email', e.target.value)} />
      {errors.email && <span>{errors.email[0]}</span>}
      <button type="submit">Submit</button>
    </form>
  );
}
```

## License

MIT
