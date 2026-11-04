/** Where the API lives, read at request time on the server. */
export const apiUrl = () => process.env.API_URL ?? 'http://localhost:3003';
