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

let gateWay: AppGateway = null;

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class AppGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    ticker: Timeout;
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('AppGateway');

    @SubscribeMessage('msgToServer')
    handleMessage(client: Socket, payload: string): void {
        this.server.emit('msgToClient', payload);
    }

    afterInit(server: Server) {
        this.logger.log('Init');
        gateWay = this;
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
        this.server.emit('message', `ir-${value}`);
    }
}
try {
    const LED = new Gpio(2, 'out');
    const irSensor = new Gpio(23, 'in', 'both');
    irSensor.watch(function (err, value) {
        //Watch for hardware interrupts on pushButton GPIO, specify callback function
        if (err) {
            //if an error
            console.error('There was an error', err); //output error message to console
            return;
        }
        console.log(value);
        if (++value == 1) {
            gateWay && gateWay.handleIrValueChange(++value);
            LED.writeSync(1);
        } else {
            LED.writeSync(0);
        }
    });
} catch (e) {
    console.log('fail to init gpio', e);
}
