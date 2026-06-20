# 🔒 Autenticación OAuth2 - Factus API

El acceso a la Factus API está protegido por autenticación estándar OAuth2 utilizando el flujo `password`.

---

## 🌍 Endpoints de Autenticación

| Entorno | URL |
| :--- | :--- |
| **Sandbox** | `https://api-sandbox.factus.com.co/oauth/token` |
| **Producción** | `https://api.factus.com.co/oauth/token` |

---

## 📥 Solicitud de Token

- **Método**: `POST`
- **Headers**:
  ```http
  Accept: application/json
  Content-Type: application/x-www-form-urlencoded
  ```

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `grant_type` | `string` | Obligatorio. Siempre `"password"`. |
| `client_id` | `string` | Obligatorio. ID de cliente provisto por Factus. |
| `client_secret` | `string` | Obligatorio. Clave secreta del `client_id`. |
| `username` | `string` | Obligatorio. Correo electrónico registrado. |
| `password` | `string` | Obligatorio. Contraseña registrada. |

### Ejemplo (cURL)
```bash
curl -X POST https://api-sandbox.factus.com.co/oauth/token \
  -H "Accept: application/json" \
  -d "grant_type=password" \
  -d "client_id=tu_client_id" \
  -d "client_secret=tu_client_secret" \
  -d "username=tu_username" \
  -d "password=tu_password"
```

## 📤 Respuesta Exitosa (200 OK)
```json
{
  "token_type": "Bearer",
  "expires_in": 3600,
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6...",
  "refresh_token": "def502008f51ef28770a04bb434d3d1912..."
}
```

## 🛡️ Uso del Token en Endpoints Protegidos
```http
Authorization: Bearer <access_token>
Accept: application/json
```

> [!NOTE]
> El token expira en **3600 segundos (1 hora)**. La implementación en NestJS cachea el token y solo lo renueva cuando está a menos de 60 segundos de expirar.

---

## 🏛️ Implementación NestJS

### Puerto de Dominio
`src/modules/factus/interfaces/factus-auth-gateway.interface.ts`
```typescript
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
```

### Adaptador HTTP de Infraestructura
`src/modules/factus/adapters/factus-http-auth.adapter.ts`
```typescript
import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFactusAuthGateway, FactusTokenResponse } from '../interfaces/factus-auth-gateway.interface';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';

@Injectable()
export class FactusHttpAuthAdapter implements IFactusAuthGateway {
  private cachedToken: string | null = null;
  private tokenExpiration: number | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.tokenExpiration && (this.tokenExpiration - now > 60)) {
      return this.cachedToken;
    }
    const authData = await this.authenticate();
    this.cachedToken = authData.accessToken;
    this.tokenExpiration = now + authData.expiresIn;
    return this.cachedToken;
  }

  async authenticate(): Promise<FactusTokenResponse> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL');
    const data = qs.stringify({
      grant_type: 'password',
      client_id: this.configService.get<string>('FACTUS_CLIENT_ID'),
      client_secret: this.configService.get<string>('FACTUS_CLIENT_SECRET'),
      username: this.configService.get<string>('FACTUS_USERNAME'),
      password: this.configService.get<string>('FACTUS_PASSWORD'),
    });

    try {
      const response$ = this.httpService.post(`${baseUrl}/oauth/token`, data, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const response = await firstValueFrom(response$);
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
      };
    } catch (error) {
      throw new Error(`Error de autenticación con Factus API: ${error.response?.data?.message || error.message}`);
    }
  }
}
```
