import axios from 'axios';
import { BillingService } from '../../billing/billing.service';

export interface HeaderParameter {
    type: string;
    text: string;
}

export interface BodyParameter {
    type: string;
    text: string;
}

export interface ButtonParameter {
    type: string;
    text?: string;
    payload?: string;
}

export class WhatsappBodyDto {
    private body: any;
    private limitText: (text: string, limit: number) => string;
    private static billingService: BillingService;
    private domain: string;

    constructor(templateName: string, receiverNumber: string, domain: string) {
        this.body = {
            messaging_product: 'whatsapp',
            to: `91${receiverNumber}`,
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'en' },
                components: []
            }
        };
        this.domain = domain;

        // Text limiting utility function
        this.limitText = (text: string, limit: number) => {
            return text?.length > limit ? text.slice(0, limit) : text || '';
        };
    }

    // Setup billing service for static usage
    static setBillingService(service: BillingService) {
        WhatsappBodyDto.billingService = service;
    }

    addHeaderComponent(parameters: HeaderParameter[]): WhatsappBodyDto {
        const formattedParameters = parameters.map(param => ({
            type: param.type,
            text: this.limitText(param.text, 60)
        }));

        this.body.template.components.push({
            type: 'header',
            parameters: formattedParameters
        });

        return this;
    }

    addBodyComponent(parameters: BodyParameter[]): WhatsappBodyDto {
        const formattedParameters = parameters.map(param => ({
            type: param.type,
            text: this.limitText(param.text, 60)
        }));

        this.body.template.components.push({
            type: 'body',
            parameters: formattedParameters
        });

        return this;
    }

    addButtonComponent(index: string, subType: string, parameters: ButtonParameter[]): WhatsappBodyDto {
        const formattedParameters = parameters.map(param => {
            const result: any = { type: param.type };

            if (param.text) {
                result.text = this.limitText(param.text, 60);
            }

            if (param.payload) {
                result.payload = this.limitText(param.payload, 60);
            }

            return result;
        });

        this.body.template.components.push({
            type: 'button',
            sub_type: subType,
            index: index,
            parameters: formattedParameters
        });

        return this;
    }

    build(): any {
        return this.body;
    }

    /**
     * Sends the WhatsApp message and records billing information
     * 
     * @param billingService Optional billing service instance (will use static instance if not provided)
     * @returns The WhatsApp API response data
     */
    async sendMessage(billingService?: BillingService): Promise<any> {
        try {
            const response = await axios.post(
                'https://graph.facebook.com/v20.0/431174140080894/messages',
                this.build(),
                {
                    headers: {
                        Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Create billing record
            const billing = billingService || WhatsappBodyDto.billingService;
            if (billing) {
                await billing.create_whatsapp_billing({
                    library_url: this.domain,
                });
            } else {
                console.warn('No billing service provided for WhatsApp message');
            }

            return response.data;
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            throw error;
        }
    }
}
