import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token;

      if (!token) {
        throw new WsException('Authentication token is missing');
      }

      const payload = this.jwtService.verify(token);
      
      // Attach user info to client for later use
      client.data.user = {
        id: payload.sub,
        organizationId: payload.organizationId,
        roles: payload.roles || [],
        permissions: payload.permissions || []
      };

      return true;
    } catch (error) {
      throw new WsException('Invalid authentication token');
    }
  }
}