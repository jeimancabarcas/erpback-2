import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IFactusAuthGateway,
  FactusTokenResponse,
} from '../interfaces/factus-auth-gateway.interface';

@Injectable()
export class FactusHttpAuthAdapter implements IFactusAuthGateway {
  private readonly logger = new Logger(FactusHttpAuthAdapter.name);
  private cachedToken: string | null = null;
  private tokenExpiration: number | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (
      this.cachedToken &&
      this.tokenExpiration &&
      this.tokenExpiration - now > 60
    ) {
      return this.cachedToken;
    }
    this.logger.log(
      'Factus access token expired or close to expiration. Authenticating...',
    );
    const authData = await this.authenticate();
    this.cachedToken = authData.accessToken;
    this.tokenExpiration = now + authData.expiresIn;
    return this.cachedToken;
  }

  async authenticate(): Promise<FactusTokenResponse> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL') || '';
    const clientId = this.configService.get<string>('FACTUS_CLIENT_ID') || '';
    const clientSecret =
      this.configService.get<string>('FACTUS_CLIENT_SECRET') || '';
    const username = this.configService.get<string>('FACTUS_USERNAME') || '';
    const password = this.configService.get<string>('FACTUS_PASSWORD') || '';

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('username', username);
    params.append('password', password);

    try {
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP status ${response.status}: ${errorText}`);
      }

      const rawData = await response.json();
      return {
        accessToken: rawData.access_token,
        refreshToken: rawData.refresh_token,
        expiresIn: rawData.expires_in,
        tokenType: rawData.token_type,
      };
    } catch (error) {
      this.logger.error(
        `Error authenticating with Factus V2 API: ${error.message}`,
      );
      throw new Error(
        `Error de autenticación con Factus API: ${error.message}`,
      );
    }
  }
}
