export interface FactusTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface IFactusAuthGateway {
  getAccessToken(): Promise<string>;
  authenticate(): Promise<FactusTokenResponse>;
}
