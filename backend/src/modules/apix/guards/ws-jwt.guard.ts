import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token;

      if (!token) {
        throw new WsException('Authentication token is missing');
      }

      const payload = this.jwtService.verify(token);
      
      // Attach user and organization to socket
      client.data.user = payload;
      client.data.userId = payload.sub;
      client.data.organizationId = payload.organizationId;
      
      return true;
    } catch (error) {
      throw new WsException('Invalid authentication token');
    }
  }
}