/** YYYY-MM-DD in the user's local timezone (UTC slicing shifts evening entries to the wrong day). */
export const localDateString = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA').format(d)
