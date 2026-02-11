import { config } from '@/config';

export async function sendTelegramNotification(message: string) {
    const { token, chatId } = config.telegram;

    if (!token || !chatId) {
        console.warn('⚠️ Telegram notification skipped: Missing token or chatId');
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Failed to send Telegram notification:', error);
        } else {
            console.log('✅ Telegram notification sent');
        }
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
}
