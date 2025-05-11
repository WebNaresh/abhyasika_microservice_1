import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { FirstReminderPlanRenewalPendingV1Dto } from 'src/utils/whatsapp/dto/first_reminder__plan_renewal_pending_v1.dto';
import { MessageService } from '../messages/message.service';
import { DatabaseService } from '../utils/database/database.service';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(
        private readonly prisma: DatabaseService,
        private readonly messageService: MessageService
    ) { }

    async findAlertForCurrentMonth(
        AlertTemplate: any
    ) {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.logger.log(`Querying alerts between ${startDate.toISOString()} and ${endDate.toISOString()}`);
        const findAlertForCurrentMonth = await this.prisma.studentAlert.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                },
                library: {
                    AlertTemplate
                }
            },
            include: {
                library: {
                    include: {
                        AlertTemplate: true
                    }
                },

                response: {
                    include: {
                        student: true
                    }
                }
            }
        });
        return findAlertForCurrentMonth;
    }

    @Cron('0 0 25 * *', {
        timeZone: 'Asia/Kolkata',
        disabled: false,
    })

    async handle25thOfMonth() {
        // time in 12 hours format
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        console.log(`🚀 ~ CronService ~ time:`, time)

        try {
            const today = new Date();
            // Log the date range we're querying
            const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            this.logger.log(`Querying alerts between ${startDate.toISOString()} and ${endDate.toISOString()}`);

            const findAlertForCurrentMonth = await this.findAlertForCurrentMonth({
                alert_on_25th_of_month: true
            });
            console.log(`🚀 ~ CronService ~ findAlertForCurrentMonth:`, findAlertForCurrentMonth)

            const totalLibrary = await this.prisma.library.findMany({
                where: {
                    id: {
                        notIn: findAlertForCurrentMonth.map(alert => alert.library.id)
                    },
                    AlertTemplate: {
                        alert_on_25th_of_month: true
                    }
                }
            })
            console.log(`🚀 ~ CronService ~ totalLibrary:`, totalLibrary)

            // create alert for total library
            await Promise.all(totalLibrary.map(async (library) => {
                const month = today.getMonth() + 1;
                const monthName = new Date(today.getFullYear(), month, 0).toLocaleString('default', { month: 'long' });
                const alert = await this.prisma.studentAlert.create({
                    data: {
                        library_id: library.id,
                        name: `Confirmation for ${monthName} ${today.getFullYear()}`,
                        description: `Please confirm your subscription for ${monthName} ${today.getFullYear()}`,
                    }
                });

                const library_student = await this.prisma.deskNode.findMany({
                    where: {
                        library_id: library.id,
                        user_id: {
                            not: null
                        },
                    },
                    include: {
                        user: true,
                        library: true
                    }
                });
                await this.prisma.studentResponse.createMany({
                    data: library_student.map(student => {
                        return {
                            alert_id: alert.id,
                            student_id: student.user_id
                        }
                    })
                });

                const send_whatsapp = library_student.map(student => {
                    return {
                        library_name: student.library.name,
                        student_name: student.user.first_name + " " + student.user.last_name,
                        student_email: student.user.email,
                        student_seat: student.seat_title,
                        student_contact: student.user.whatsapp_no ?? student.user.phone_no,
                        library_contact: student.library.phone_no,
                        library_url: student.library.library_url,
                    }
                });

                // Add a message to the queue for each library
                await this.messageService.firstReminder(send_whatsapp);
            }));

            this.logger.log(`Total libraries: ${totalLibrary.length}`);


            // Your business logic here
            // For example, you could call your alert service to send notifications
            this.logger.log('Successfully executed last 5 days of month cron job');
        } catch (error) {
            this.logger.error('Error in last 5 days of month cron job:', error);
        }

    }


    @Cron('0 0 27 * *', {
        timeZone: 'Asia/Kolkata',
        disabled: false,
    })
    async handle27thOfMonth() {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.logger.log(`Querying alerts between ${startDate.toISOString()} and ${endDate.toISOString()}`);

        // Get alerts for both 25th and 27th of the month
        const findAlertFor25th = await this.findAlertForCurrentMonth({
            alert_on_25th_of_month: true
        });
        console.log(`🚀 ~ CronService ~ findAlertFor25th:`, findAlertFor25th.length);

        const findAlertFor27th = await this.findAlertForCurrentMonth({
            alert_on_27th_of_month: true
        });
        console.log(`🚀 ~ CronService ~ findAlertFor27th:`, findAlertFor27th.length);

        // Get ALL libraries with alert_on_27th_of_month: true
        const totalLibrary = await this.prisma.library.findMany({
            where: {
                AlertTemplate: {
                    alert_on_27th_of_month: true
                }
            }
        });
        console.log(`🚀 ~ CronService ~ totalLibrary:`, totalLibrary.length);

        // Process all libraries
        await Promise.all(totalLibrary.map(async (library) => {
            // Check if alert exists for this library for either 25th or 27th
            const existingAlert25th = findAlertFor25th.find(a => a.library.id === library.id);
            const existingAlert27th = findAlertFor27th.find(a => a.library.id === library.id);

            if (existingAlert25th || existingAlert27th) {
                // Send second reminder if alert exists for either 25th or 27th
                const library_student = await this.prisma.deskNode.findMany({
                    where: {
                        library_id: library.id,
                        user_id: {
                            not: null
                        },
                    },
                    include: {
                        user: true,
                        library: true
                    }
                });

                const send_whatsapp = library_student.map(student => {
                    return {
                        library_name: student.library.name,
                        student_name: student.user.first_name + " " + student.user.last_name,
                        student_email: student.user.email,
                        student_seat: student.seat_title,
                        student_contact: student.user.whatsapp_no ?? student.user.phone_no,
                        library_contact: student.library.phone_no,
                        library_url: student.library.library_url,
                    }
                });

                await this.messageService.secondReminder(send_whatsapp);

                // Update whatsapp_notification_send counter for second reminder
                await this.prisma.studentResponse.updateMany({
                    where: {
                        alert_id: existingAlert25th ? existingAlert25th.id : existingAlert27th.id,
                        student_id: {
                            in: library_student.map(student => student.user_id)
                        }
                    },
                    data: {
                        whatsapp_notification_send: {
                            increment: 1
                        }
                    }
                });

                this.logger.log(`Sending second reminder for library: ${library.name} (${existingAlert25th ? '25th' : '27th'} of month)`);
            } else {
                // Create new alert and send first reminder if no alert exists for either 25th or 27th
                const month = today.getMonth() + 1;
                const monthName = new Date(today.getFullYear(), month, 0).toLocaleString('default', { month: 'long' });
                const alert = await this.prisma.studentAlert.create({
                    data: {
                        library_id: library.id,
                        name: `Confirmation for ${monthName} ${today.getFullYear()}`,
                        description: `Please confirm your subscription for ${monthName} ${today.getFullYear()}`,
                    }
                });

                const library_student = await this.prisma.deskNode.findMany({
                    where: {
                        library_id: library.id,
                        user_id: {
                            not: null
                        },
                    },
                    include: {
                        user: true,
                        library: true
                    }
                });

                await this.prisma.studentResponse.createMany({
                    data: library_student.map(student => {
                        return {
                            alert_id: alert.id,
                            student_id: student.user_id,
                            whatsapp_notification_send: 1
                        }
                    })
                });

                const send_whatsapp = library_student.map(student => {
                    return {
                        library_name: student.library.name,
                        student_name: student.user.first_name + " " + student.user.last_name,
                        student_email: student.user.email,
                        student_seat: student.seat_title,
                        student_contact: student.user.whatsapp_no ?? student.user.phone_no,
                        library_contact: student.library.phone_no,
                        library_url: student.library.library_url,
                    }
                });

                await this.messageService.firstReminder(send_whatsapp);
                this.logger.log(`Sending first reminder for library: ${library.name} (27th of month)`);
            }
        }));

        this.logger.log(`Total libraries processed for 27th of month: ${totalLibrary.length}`);
    }

    @Cron('0 0 28 * *', {
        timeZone: 'Asia/Kolkata',
        disabled: false,
    })
    async handle28thOfMonth() {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.logger.log(`Querying alerts between ${startDate.toISOString()} and ${endDate.toISOString()}`);

        // Get alerts for 25th, 27th, and 28th of the month
        const findAlertFor25th = await this.findAlertForCurrentMonth({
            alert_on_25th_of_month: true
        });
        console.log(`🚀 ~ CronService ~ findAlertFor25th:`, findAlertFor25th.length);

        const findAlertFor27th = await this.findAlertForCurrentMonth({
            alert_on_27th_of_month: true
        });
        console.log(`🚀 ~ CronService ~ findAlertFor27th:`, findAlertFor27th.length);

        const findAlertFor28th = await this.findAlertForCurrentMonth({
            alert_on_28th_of_month: true
        });
        console.log(`🚀 ~ CronService ~ findAlertFor28th:`, findAlertFor28th.length);

        // Get ALL libraries with alert_on_28th_of_month: true
        const totalLibrary = await this.prisma.library.findMany({
            where: {
                AlertTemplate: {
                    alert_on_28th_of_month: true
                }
            }
        });
        console.log(`🚀 ~ CronService ~ totalLibrary:`, totalLibrary.length);

        // Process all libraries
        await Promise.all(totalLibrary.map(async (library) => {
            // Check if alert exists for this library for 25th, 27th, or 28th
            const existingAlert25th = findAlertFor25th.find(a => a.library.id === library.id);
            const existingAlert27th = findAlertFor27th.find(a => a.library.id === library.id);
            const existingAlert28th = findAlertFor28th.find(a => a.library.id === library.id);

            if (existingAlert25th || existingAlert27th || existingAlert28th) {
                // Send third reminder if alert exists for any of the days
                const library_student = await this.prisma.deskNode.findMany({
                    where: {
                        library_id: library.id,
                        user_id: {
                            not: null
                        },
                    },
                    include: {
                        user: true,
                        library: true
                    }
                });

                const send_whatsapp = library_student.map(student => {
                    return {
                        library_name: student.library.name,
                        student_name: student.user.first_name + " " + student.user.last_name,
                        student_email: student.user.email,
                        student_seat: student.seat_title,
                        student_contact: student.user.whatsapp_no ?? student.user.phone_no,
                        library_contact: student.library.phone_no,
                        library_url: student.library.library_url,
                    }
                });

                await this.messageService.thirdReminder(send_whatsapp);

                // Update whatsapp_notification_send counter for third reminder
                const alertId = existingAlert25th ? existingAlert25th.id : (existingAlert27th ? existingAlert27th.id : existingAlert28th.id);
                await this.prisma.studentResponse.updateMany({
                    where: {
                        alert_id: alertId,
                        student_id: {
                            in: library_student.map(student => student.user_id)
                        }
                    },
                    data: {
                        whatsapp_notification_send: {
                            increment: 1
                        }
                    }
                });

                this.logger.log(`Sending third reminder for library: ${library.name} (${existingAlert25th ? '25th' : (existingAlert27th ? '27th' : '28th')} of month)`);
            } else {
                // Create new alert and send first reminder if no alert exists for any of the days
                const month = today.getMonth() + 1;
                const monthName = new Date(today.getFullYear(), month, 0).toLocaleString('default', { month: 'long' });
                const alert = await this.prisma.studentAlert.create({
                    data: {
                        library_id: library.id,
                        name: `Confirmation for ${monthName} ${today.getFullYear()}`,
                        description: `Please confirm your subscription for ${monthName} ${today.getFullYear()}`,
                    }
                });

                const library_student = await this.prisma.deskNode.findMany({
                    where: {
                        library_id: library.id,
                        user_id: {
                            not: null
                        },
                    },
                    include: {
                        user: true,
                        library: true
                    }
                });

                await this.prisma.studentResponse.createMany({
                    data: library_student.map(student => {
                        return {
                            alert_id: alert.id,
                            student_id: student.user_id,
                            whatsapp_notification_send: 1
                        }
                    })
                });

                const send_whatsapp = library_student.map(student => {
                    return {
                        library_name: student.library.name,
                        student_name: student.user.first_name + " " + student.user.last_name,
                        student_email: student.user.email,
                        student_seat: student.seat_title,
                        student_contact: student.user.whatsapp_no ?? student.user.phone_no,
                        library_contact: student.library.phone_no,
                        library_url: student.library.library_url,
                    }
                });

                await this.messageService.firstReminder(send_whatsapp);
                this.logger.log(`Sending first reminder for library: ${library.name} (28th of month)`);
            }
        }));

        this.logger.log(`Total libraries processed for 28th of month: ${totalLibrary.length}`);
    }

    // @Cron('*/30 * * * * *', {
    @Cron('0 0 11 * * *', {
        timeZone: 'Asia/Kolkata',
        disabled: false,
    })
    async handleDailyExpiredPlans() {
        this.logger.log('Running daily check for expired plans');
        console.log("Running daily check for expired plans")

        try {
            const today = new Date();

            const expiredPlans = await this.prisma.userCurrentPlan.findMany({
                where: {
                    end_date: {
                        lt: today
                    },
                    is_completed: false,
                    due_payment_reminder_notification_send: {
                        lt: 6
                    },
                    user: {
                        // id: "b36cb0ea-3aa3-4522-a450-d686f5d43646",
                        library_in: {
                            isNot: null
                        },
                    },
                    library: {
                        receipt_settings: {
                            auto_reminder_on_expiry: true
                        }
                    },
                    // library_id: "96c29951-dbc1-468a-9145-6822cc2860f1"

                },
                include: {
                    user: true,
                    library: true,
                    desk: true
                }
            });

            if (expiredPlans.length > 0) {
                expiredPlans.forEach(async (plan) => {
                    console.log(`🚀 ~ expiredPlans:`, plan.user.first_name)
                    // Check if it's time to send a notification (every 2 days)
                    console.log(`🚀 ~ plan.due_payment_reminder_notification_send:`, plan.due_payment_reminder_notification_send)
                    // Only proceed if the days since expiry % 2 == 0


                    // Only send notification if days since expiry is divisible by 2 (every 2 days)
                    const send_whatsapp: FirstReminderPlanRenewalPendingV1Dto = {
                        library_name: plan.library.name,
                        member_name: plan.user.first_name + " " + plan.user.last_name,
                        library_contact: plan.library.phone_no,
                        receiver_mobile_number: plan.user.whatsapp_no ?? plan.user.phone_no,
                        library_url: plan.library.library_url,
                    }

                    if (plan.due_payment_reminder_notification_send === 0) {
                        await this.messageService.firstReminderPlanRenewalPendingV1(send_whatsapp);
                        this.logger.log(`Sent first reminder to ${plan.user.first_name}`);
                    } else if (plan.due_payment_reminder_notification_send === 2) {
                        await this.messageService.secondReminderPlanRenewalPendingV1(send_whatsapp);
                        this.logger.log(`Sent second reminder to ${plan.user.first_name}`);
                    } else if (plan.due_payment_reminder_notification_send === 4) {
                        await this.messageService.thirdReminderPlanRenewalPendingV1(send_whatsapp);
                        this.logger.log(`Sent third reminder to ${plan.user.first_name}`);
                    }

                    // update due_payment_reminder_notification_send
                    await this.prisma.userCurrentPlan.update({
                        where: {
                            id: plan.id
                        },
                        data: {
                            due_payment_reminder_notification_send: {
                                increment: 1
                            }
                        }
                    });
                });
            }

            this.logger.log(`Found ${expiredPlans.length} expired plans with is_completed set to false`);
        } catch (error) {
            this.logger.error('Error checking expired plans:', error);
        }
    }

    @Cron('*/10 * * * * *', {
        // @Cron('0 0 11 * * *', {
        timeZone: 'Asia/Kolkata',
        disabled: false,
    })
    async handleDailyExpiredPlansV2() {
        this.logger.log('Running daily check for expired plans');
        const response = await axios.get("https://google.com")
        console.log(`🚀 ~ response:`, response)
        await this.prisma.userCurrentPlan.update({
            where: {
                id: "cm7r3xz9j0002io1xepnjza2y"
            },
            data: {
                due_payment_reminder_notification_send: {
                    increment: 1
                }
            }
        }).then(async (res) => {
            console.log(`🚀 ~ res:`, res.due_payment_reminder_notification_send)
        })
    }
}