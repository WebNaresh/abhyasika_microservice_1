import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import { BillingService } from '../billing/billing.service';
import { AdmissionAdminDto } from './dto/admission-admin.dto';
import { AdmissionDto } from './dto/admission.dto';
import {
  ConfirmationTemplateDto,
  CreateWhatsappDto,
  WhatsappMessagePayload,
} from './dto/create-whatsapp.dto';
import { FirstReminderPlanRenewalPendingV1Dto } from './dto/first_reminder__plan_renewal_pending_v1.dto';
import { InterestedMessageDto } from './dto/interested_message.dto';
import { PaymentReceivedNotificationDto } from './dto/payment_received_notification.dto';
import { PaymentRequestRejectedDto } from './dto/payment_request_rejected.dto';
import { WhatsappBodyDto } from './dto/whatsapp_body.dto';

@Injectable()
export class WhatsappService implements OnModuleInit {
  constructor(private readonly billing_service: BillingService) { }

  // Initialize the WhatsappBodyDto with billing service
  onModuleInit() {
    WhatsappBodyDto.setBillingService(this.billing_service);
  }

  // Simple function to log and throw errors for axios requests
  handleAxiosError(error: any) {
    console.error(
      'Axios request failed:',
      error.response?.data || error.message,
    );
    throw new HttpException(
      'Failed to send WhatsApp message',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async hello_world() {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/437010516154310/messages`,
        {
          messaging_product: 'whatsapp',
          to: '919371505828',
          type: 'template',
          template: {
            name: 'hello_world',
            language: {
              code: 'en_US',
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`🚀 ~ WhatsappService ~ response:`, response);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async send_text_message(text: string) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/437010516154310/messages`,
        {
          messaging_product: 'whatsapp',
          to: '919371505828',
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`🚀 ~ WhatsappService ~ response:`, response);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async send_image_link() {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/437010516154310/messages`,
        {
          messaging_product: 'whatsapp',
          to: '917219725697',
          type: 'image',
          image: {
            link: 'https://neststudyroom.s3.ap-south-1.amazonaws.com/main_logo.png',
            caption: 'This is a caption',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`🚀 ~ WhatsappService ~ response:`, response);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async send_media_pdf() {
    try {
      const data = new FormData();
      data.append('messaging_product', 'whatsapp');
      data.append('file', fs.createReadStream(process.cwd() + '/logo.png'), {
        contentType: 'image/png',
      });
      data.append('type', 'image/png');

      const response = await axios.post(
        `https://graph.facebook.com/v20.0/437010516154310/media`,
        data,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
          },
        },
      );
      console.log(`🚀 ~ WhatsappService ~ media upload response:`, response);

      const response2 = await axios.post(
        `https://graph.facebook.com/v20.0/437010516154310/messages`,
        {
          messaging_product: 'whatsapp',
          to: '917219725697',
          type: 'image',
          image: {
            id: response.data.id,
            caption: 'This is a caption',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response2.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  limitText = (text: string, limit: number) => {
    return text.length > limit ? text.slice(0, limit) : text;
  };
  async send_payment_reminder(props: CreateWhatsappDto) {
    console.log(`🚀 ~ WhatsappService ~ send_payment_reminder props:`, props);
    const {
      library_name,
      library_contact,
      library_url,
      student_email,
      student_name,
      student_contact,
    } = props;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/431174140080894/messages`,
        {
          messaging_product: 'whatsapp',
          to: `91${student_contact}`,
          type: 'template',
          template: {
            name: 'abhyasika_payment_reminder',
            language: { code: 'en' },
            components: [
              {
                type: 'header',
                parameters: [
                  { type: 'text', text: this.limitText(library_name, 60) },
                ],
              },
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: this.limitText(student_name, 60) },
                  { type: 'text', text: this.limitText(library_name, 60) },
                  { type: 'text', text: this.limitText(student_email, 60) },
                  { type: 'text', text: this.limitText(library_contact, 60) },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  {
                    type: 'text',
                    text: this.limitText(
                      `library_redirect_method/${library_url}`,
                      60,
                    ),
                  },
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: library_url,
        })
        return response.data;
      });

      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  // Similar error handling for pending_payment
  async pending_payment(props: WhatsappMessagePayload) {
    console.log(`🚀 ~ WhatsappService ~ pending_payment props:`, props);
    const {
      library_name,
      library_contact,
      library_url,
      student_email,
      student_name,
      student_contact,
      student_seat
    } = props;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/431174140080894/messages`,
        {
          messaging_product: 'whatsapp',
          to: `91${student_contact}`,
          type: 'template',
          template: {
            name: 'abhyasika_pending_payment',
            language: { code: 'en' },
            components: [
              {
                type: 'header',
                parameters: [
                  { type: 'text', text: this.limitText(library_name, 20) },
                ],
              },
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: this.limitText(student_name, 60) },
                  { type: 'text', text: this.limitText(student_seat === "N/A" ? library_name : student_seat, 60) },
                  { type: 'text', text: this.limitText(student_email, 60) },
                  { type: 'text', text: this.limitText(library_name, 60) },
                  { type: 'text', text: this.limitText(library_contact, 60) },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  {
                    type: 'text',
                    text: this.limitText(
                      `library_redirect_method/${library_url}`,
                      60,
                    ),
                  },
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: library_url,
        })
        return response.data;
      });
      console.log(`🚀 ~ file: whatsapp.service.ts:286 ~ WhatsappService ~ response:`, response.data)
      return response.data;
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async confirmation_template(props: ConfirmationTemplateDto) {
    const {
      library_name,
      library_contact,
      library_url,
      student_email,
      student_name,
      student_contact,
      student_seat,
      library_image
    } = props;

    console.log(`🚀 ~ WhatsappService ~ library_url:`, library_url)
    // fallback image

    const body = {
      messaging_product: 'whatsapp',
      to: `91${student_contact}`,
      type: 'template',
      template: {
        name: 'library_seat_confirmation_v2',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: this.limitText(student_name || '', 60) },
              { type: 'text', text: this.limitText(library_name || '', 60) },
              { type: 'text', text: this.limitText(student_email || '', 60) },
              { type: 'text', text: this.limitText(library_contact || '', 60) },
              { type: 'text', text: this.limitText(student_seat || '', 60) }
            ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: "payload",
                payload: this.limitText(`/${library_url}`, 60),
              }
            ]
          }
        ]
      }
    };

    const response = await axios.post(
      'https://graph.facebook.com/v20.0/431174140080894/messages',
      body,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    ).then(async (response) => {

      await this.billing_service.create_whatsapp_billing({
        library_url: library_url,
      })
      return response.data;
    }).catch((_error) => {
      return {
        data: 'Error sending WhatsApp message',
        success: false
      }
    });

    return response.data;

  }

  async send_payment_receipt(props: {
    library_name: string;
    student_name: string;
    student_email: string;
    seat_title: string;
    plan_name: string;
    plan_expiration_date: string;
    library_contact_no: string;
    student_contact: string
    library_url: string
  }) {
    console.log(`🚀 ~ file: whatsapp.service.ts:404 ~ WhatsappService ~ props:`, props)

    if (props.student_contact === null || props.student_contact === undefined || props.student_contact === "") {
      console.error()
      return {}
    }

    try {

      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'study_room_payment_receipt',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.student_email || '', 60) },
                { type: 'text', text: this.limitText(props.seat_title || 'N/A', 60) },
                { type: 'text', text: this.limitText(props.plan_name || '', 60) },
                { type: 'text', text: this.limitText(props.plan_expiration_date || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
                { type: 'text', text: this.limitText(props.library_contact_no || '', 60) }
              ]
            },

          ]
        }
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: props.library_url,
        })
        return response.data;
      });

      return response.data;

    } catch (error) {
      console.log(error);
    }


  }

  async send_interested_notification(props: InterestedMessageDto) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.library_contact}`,
        type: 'template',
        template: {
          name: 'interested_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                {
                  type: 'text',
                  text: this.limitText(props.interested_desk || '', 60)
                },
                {
                  type: 'text',
                  text: this.limitText(props.student_contact || '', 60)
                },
                // time should look like 17-jan-2024 6:46 PM
                {
                  type: 'text',
                  text: this.limitText(props.time_of_interested.toLocaleString(), 60)
                }

              ]
            },

          ]
        }
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {
        console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

        await this.billing_service.create_whatsapp_billing({
          library_url: props.library_url,
        })
        return response.data;
      });
    } catch (error) {
      console.log(error)
    }


  }

  async send_admission_notification(props: AdmissionDto) {
    if (props.student_contact === null || props.student_contact === undefined || props.student_contact === "") {
      console.error()
      return {}
    }

    // Set default values if not provided
    const branch_name = props.branch_name || "N/A";
    const room_name = props.room_name || "N/A";
    const desk_name = props.desk_name || "N/A";
    const student_contact = props.student_contact || "9370928324";

    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'admission_successful_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
                { type: 'text', text: this.limitText(branch_name, 60) },
                { type: 'text', text: this.limitText(room_name, 60) },
                { type: 'text', text: this.limitText(desk_name, 60) },
                { type: 'text', text: this.limitText(props.plan_name || '', 60) },
                { type: 'text', text: this.limitText(props.admission_date || '', 60) },
                { type: 'text', text: this.limitText(props.admission_end_date || '', 60) },
                { type: 'text', text: this.limitText(`91${props.library_contact_no}` || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
              ]
            },

          ]
        },
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`🚀 ~ file: whatsapp.service.ts:576 ~ WhatsappService ~ response.data:`, response.data)

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      return response.data;
    } catch (error) {
      console.error(error)
    }
  }

  async send_seat_change_notification(props: {
    library_name: string;
    student_name: string;
    new_seat: string;
    student_contact?: string;
    library_url: string
  }) {

    try {
      const student_contact = props.student_contact || "9370928324";
      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'seat_change_confirmation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.new_seat || '', 60) },
                { type: 'text', text: this.limitText(student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
              ]
            },
          ]
        },
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: props.library_url,
        })
        return response.data;
      });

      return response.data;
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async notification_report_admin(props: {
    library_owner_name: string,
    branch_name: string,
    branch_total_capacity: string,
    branch_reserved_capacity: string,
    branch_unreserved_capacity: string,
    branch_vacant_seat: string,
    branch_expiring_plan: string,
    branch_pending_members: string,
    branch_interested_members: string,
    branch_url: string,
    library_owner_contact: string

  }) {
    console.log(`🚀 ~ WhatsappService ~ props:`, props)
    const date = new Date();
    // format date in 12/01/2025
    const formatted_date = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.library_owner_contact}`,
        type: 'template',
        template: {
          name: 'notification_report_admin',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_owner_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [

                { type: 'text', text: this.limitText(formatted_date || '', 60) },
                { type: 'text', text: this.limitText(props.branch_total_capacity || '', 60) },
                { type: 'text', text: this.limitText(props.branch_reserved_capacity || '', 60) },
                { type: 'text', text: this.limitText(props.branch_unreserved_capacity || '', 60) },
                { type: 'text', text: this.limitText(props.branch_vacant_seat || '', 60) },
                { type: 'text', text: this.limitText(props.branch_expiring_plan || '', 60) },
                { type: 'text', text: this.limitText(props.branch_pending_members || '', 60) },
                { type: 'text', text: this.limitText(props.branch_interested_members || '', 60) },
                { type: 'text', text: this.limitText(`https://${props.branch_url}.abhyasika.online`, 60) },
                {
                  type: 'text',
                  text: this.limitText(props.branch_name || '', 60)
                }
              ]
            },
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      ).then(async (response) => {

        await this.billing_service.create_whatsapp_billing({
          library_url: props.branch_url,
        })
        return response.data;
      });

      return response.data;

    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }



  }

  async send_cancel_membership_email(props: {
    to: string,
    user_name: string,
    library_name: string,
    library_contact_no: string,
    library_url: string
  }) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.to}`,
        type: 'template',
        template: {
          name: 'membership_cancellation_notification ',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.user_name, 60) },
                { type: 'text', text: this.limitText(props.library_contact_no, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data;
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async send_first_remindar_reservation(props: {
    library_name: string,
    student_name: string,
    student_email: string,
    student_seat: string,
    student_contact: string,
    library_contact: string,
    library_url: string
  }) {
    console.log(`🚀 ~ WhatsappService ~ props:`, props)
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'first_remindar_reservation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.student_email, 60) },
                { type: 'text', text: this.limitText(props.student_seat, 60) },
                { type: 'text', text: this.limitText(props.student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_contact, 60) },
                { type: 'text', text: this.limitText(props.library_url, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data
    } catch (error) {
      if (props.student_contact === "9370928324") {
        console.error(error);
      }
    }
  }
  async second_remindar_reservation(props: {
    library_name: string,
    student_name: string,
    student_email: string,
    student_seat: string,
    student_contact: string,
    library_contact: string,
    library_url: string
  }) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'second_remindar_reservation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.student_seat, 60) },
                { type: 'text', text: this.limitText(props.library_url, 60) },
                { type: 'text', text: this.limitText(props.student_email, 60) },
                { type: 'text', text: this.limitText(props.student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.library_contact, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data
    } catch (error) {
      if (props.student_contact === "9370928324") {
        console.error(error);
      }
    }
  }
  async last_remindar_reservation(props: {
    library_name: string,
    student_name: string,
    student_email: string,
    student_seat: string,
    student_contact: string,
    library_contact: string,
    library_url: string
  }) {
    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${props.student_contact}`,
        type: 'template',
        template: {
          name: 'last_remindar_reservation',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.student_seat, 60) },
                { type: 'text', text: this.limitText(props.library_url, 60) },
                { type: 'text', text: this.limitText(props.student_email, 60) },
                { type: 'text', text: this.limitText(props.student_contact, 60) },
                { type: 'text', text: this.limitText(props.library_name, 60) },
                { type: 'text', text: this.limitText(props.library_contact, 60) },
              ]
            }
          ]
        },
      }

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      console.log(`🚀 ~ WhatsappService ~ response:`, response.data)

      return response.data
    } catch (error) {
      if (props.student_contact === "9370928324") {
        console.error(error);
      }
    }
  }
  async send_admission_notification_admin(props: AdmissionAdminDto) {
    if (props.library_contact === null || props.library_contact === undefined || props.library_contact === "") {
      console.error()
      return {}
    }

    const student_contact = props.library_contact || "9370928324";

    try {
      const body = {
        messaging_product: 'whatsapp',
        to: `91${student_contact}`,
        type: 'template',
        template: {
          name: 'owner_admission_notification',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                { type: 'text', text: this.limitText(props.library_name, 60) },
              ],
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.limitText(props.student_name || '', 60) },
                { type: 'text', text: this.limitText(props.branch_name || '', 60) },
                { type: 'text', text: this.limitText(props.room_name || '', 60) },
                { type: 'text', text: this.limitText(props.desk_name || '', 60) },
                { type: 'text', text: this.limitText(props.plan_name || '', 60) },
                { type: 'text', text: this.limitText(props.plan_start_date || '', 60) },
                { type: 'text', text: this.limitText(props.plan_end_date || '', 60) },
                { type: 'text', text: this.limitText(props.library_name || '', 60) },
              ]
            },

          ]
        },
      };

      const response = await axios.post(
        'https://graph.facebook.com/v20.0/431174140080894/messages',
        body,
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_API_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`🚀 ~ file: whatsapp.service.ts:576 ~ WhatsappService ~ response.data:`, response.data)
      await this.billing_service.create_whatsapp_billing({
        library_url: props.library_url,
      })

      return response.data;
    } catch (error) {
      console.error(error)
    }
  }

  async send_payment_received_notification(props: PaymentReceivedNotificationDto) {
    try {
      // Create the body using the WhatsappBodyDto class with domain parameter
      const whatsappBody = new WhatsappBodyDto(
        'payment_received_notification',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.desk_title },
          { type: 'text', text: props.room_title }
        ]);

      // Use the new sendMessage method which now has domain built-in
      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async send_payment_request_rejected(props: PaymentRequestRejectedDto) {
    try {
      const whatsappBody = new WhatsappBodyDto(
        'payment_request_rejected',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact }
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async send_first_reminder_plan_renewal_pending_v1(props: FirstReminderPlanRenewalPendingV1Dto) {
    try {
      const whatsappBody = new WhatsappBodyDto(
        'first_reminder_plan_renewal_pending_v1',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact },
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async send_second_reminder_plan_renewal_pending_v1(props: FirstReminderPlanRenewalPendingV1Dto) {
    try {
      const whatsappBody = new WhatsappBodyDto(
        'second_reminder__plan_renewal_pending',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact }
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }

  async send_third_reminder_plan_renewal_pending_v1(props: FirstReminderPlanRenewalPendingV1Dto) {
    try {
      const whatsappBody = new WhatsappBodyDto(
        'third_reminder__plan_renewal_pending',
        props.receiver_mobile_number,
        props.library_url
      )
        .addBodyComponent([
          { type: 'text', text: props.member_name },
          { type: 'text', text: props.library_url },
          { type: 'text', text: props.library_name },
          { type: 'text', text: props.library_contact }
        ]);

      return await whatsappBody.sendMessage();
    } catch (error) {
      console.error(error);
      this.handleAxiosError(error);
    }
  }
}

