import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Gpio } from 'onoff';
import Timeout = NodeJS.Timeout;

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class AppGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    ticker: Timeout;
    lastIrValue: number;
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('AppGateway');

    @SubscribeMessage('msgToServer')
    handleMessage(client: Socket, payload: string): void {
        this.server.emit('msgToClient', payload);
    }

    afterInit(server: Server) {
        this.logger.log('Init');
        const gateWay = this;
        try {
            const irSensor = new Gpio(14, 'in', 'both');
            irSensor.watch(function (err, value) {
                if (err) {
                    console.error('There was an error', err);
                    return;
                }
                console.log(value);
                gateWay && gateWay.handleIrValueChange(++value);
            });
        } catch (e) {
            console.log('fail to init gpio', e);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket, ...args: any[]) {
        const gateWay = this;
        this.logger.log(`Client connected: ${client.id}`);
        const [logger, server] = [this.logger, this.server];
        function loopTicker() {
            gateWay.ticker && clearTimeout(gateWay.ticker);
            logger.log(`ticker :`, client.id);
            server.emit('message', 'pass');
            gateWay.ticker = setTimeout(() => {
                loopTicker();
            }, 3000);
        }
        loopTicker();
    }

    handleIrValueChange(value: number) {
        if (this.lastIrValue === 0 && value === 1) {
            this.server.emit('message', `ir-${value}`);
        }
        this.lastIrValue = value;
    }
}
