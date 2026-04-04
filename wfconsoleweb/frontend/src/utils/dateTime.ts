const ISO_TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;

const normalizeDateInput = (value: string | number | Date): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return new Date(Number.NaN);
  }

  const normalized = ISO_TIMEZONE_SUFFIX.test(trimmed) ? trimmed : `${trimmed}Z`;
  return new Date(normalized);
};

export const formatLocalDateTime = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const date = normalizeDateInput(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  });
};

export const formatLocalTime = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const date = normalizeDateInput(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
};