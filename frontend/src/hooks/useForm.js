import { useCallback, useState } from 'react';

export default function useForm(initialValues = {}, validators = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const validateField = useCallback((name, value) => {
    const validator = validators[name];
    if (!validator) return null;
    return validator(value, values);
  }, [validators, values]);

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setValues(v => ({ ...v, [name]: value }));
    const error = validateField(name, value);
    setErrors(err => ({ ...err, [name]: error }));
  }, [validateField]);

  const isValid = useCallback(() => {
    const newErrors = {};
    Object.keys(validators).forEach(field => {
      const error = validateField(field, values[field]);
      if (error) newErrors[field] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validators, validateField, values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  return { values, errors, onChange, isValid, reset, setValues, setErrors };
}
