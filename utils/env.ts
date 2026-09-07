function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example and fill it in.`);
  }
  return value;
}

export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://citizen.cosmosmart.example',
  get citizenUsername(): string {
    return required('CITIZEN_USERNAME');
  },
  get citizenPassword(): string {
    return required('CITIZEN_PASSWORD');
  },
};
