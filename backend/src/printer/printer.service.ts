import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import { resolve } from 'path';

@Injectable()
export class PrinterService {
    private readonly logger = new Logger(PrinterService.name);

    //Envoie un flux de texte brut à une imprimante thermique ESC/POS via Socket TCP
    async sendToPrinter(
        ip: string,
        port: number,
        textRaw: string
    ) : Promise<boolean> {
                if(!ip) {
                    this.logger.warn("Aucune adresse IP Configurée pour ce POS. Impression annulée");
                    return false; 
                }
                return new Promise((resolve) => {
                    const client = new net.Socket();

                    //fixer le timeout de 5 sec pour ne pas bloquer le serveur est eteinte
                    client.setTimeout(5000);

                    client.connect(port, ip, () => {
                        //envoi du text + commandes despacement (saut des ligne pour la coupe papier)
                        client.write(textRaw + '\n\n\n\n');
                        client.end(); // end canal socket
                        resolve(true);
                    });

                    client.on('error', (err) => {
                        this.logger.error(`[PANNE RESEAU] Imprimante injoignable sur ${ip}:${port} - ${err.message}`);
                        resolve(false);
                    });

                    client.on('timeout', () => {
                        this.logger.error(`[TIMEOUT] Imprimante avec ${ip}:${port} ne répond pas.[verifier si l'imprimante est connectée et allumentée au courant]`);
                        client.destroy();
                        resolve(false);
                    });
                });
            }
}
