# WhatsApp Bulk Messaging Examples

## 🚀 **Basic Bulk Text Messages**

### Example 1: Simple Notifications
```bash
curl -X POST http://localhost:3000/api/v1/webjs/sessions/user_123/send-bulk-messages \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "to": "+919370928324",
        "message": "Your appointment is confirmed for tomorrow at 10 AM"
      },
      {
        "to": "+919876543210",
        "message": "Payment reminder: Your fee is due on 15th January"
      },
      {
        "to": "+918765432109",
        "message": "Class schedule updated. Check the new timetable"
      }
    ]
  }'
```

### Example 2: Personalized Messages
```bash
curl -X POST http://localhost:3000/api/v1/webjs/sessions/user_123/send-bulk-messages \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "to": "+919370928324",
        "message": "Hi John! Your exam results are ready. You scored 85% in Mathematics."
      },
      {
        "to": "+919876543210",
        "message": "Hello Sarah! Welcome to Abhyasika. Your enrollment is confirmed."
      },
      {
        "to": "+918765432109",
        "message": "Dear Mike, your assignment submission deadline is tomorrow."
      }
    ]
  }'
```

## 📎 **Bulk Messages with Media**

### Example 3: Documents and Images
```bash
curl -X POST http://localhost:3000/api/v1/webjs/sessions/user_123/send-bulk-messages \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "to": "+919370928324",
        "message": "Here is your certificate",
        "media_urls": ["https://example.com/certificates/john_certificate.pdf"]
      },
      {
        "to": "+919876543210",
        "message": "Study material for next class",
        "media_urls": ["https://example.com/materials/chapter5.pdf"]
      },
      {
        "to": "+918765432109",
        "message": "Event photos from yesterday",
        "media_urls": ["https://example.com/photos/event_2024.jpg"]
      }
    ]
  }'
```

## 🎯 **Use Cases**

### Student Notifications
```json
{
  "messages": [
    {
      "to": "+919370928324",
      "message": "📚 Reminder: Physics exam tomorrow at 9 AM. Good luck!"
    },
    {
      "to": "+919876543210",
      "message": "📝 Assignment deadline extended to Friday. Submit via portal."
    },
    {
      "to": "+918765432109",
      "message": "🎉 Congratulations! You've been selected for the scholarship program."
    }
  ]
}
```

### Payment Reminders
```json
{
  "messages": [
    {
      "to": "+919370928324",
      "message": "💰 Fee reminder: ₹5000 due on 15th Jan. Pay online to avoid late fees."
    },
    {
      "to": "+919876543210",
      "message": "✅ Payment received! Your receipt: #AB123456. Thank you!"
    },
    {
      "to": "+918765432109",
      "message": "⚠️ Overdue payment: ₹3000. Please clear dues to continue classes."
    }
  ]
}
```

### Event Announcements
```json
{
  "messages": [
    {
      "to": "+919370928324",
      "message": "🎪 Annual Day celebration on 25th Jan. Venue: Main Auditorium, 6 PM"
    },
    {
      "to": "+919876543210",
      "message": "📅 Parent-Teacher meeting scheduled for 20th Jan. Please confirm attendance."
    },
    {
      "to": "+918765432109",
      "message": "🏆 Sports Day registration open! Register by 18th Jan."
    }
  ]
}
```

## 📊 **Expected Response Format**

```json
{
  "success": true,
  "total_messages": 3,
  "successful_sends": 2,
  "failed_sends": 1,
  "results": [
    {
      "to": "+919370928324",
      "status": "success",
      "message_id": "wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMA",
      "timestamp": "2024-01-15T12:00:00Z"
    },
    {
      "to": "+919876543210",
      "status": "failed",
      "error": "Invalid phone number format",
      "timestamp": "2024-01-15T12:00:01Z"
    },
    {
      "to": "+918765432109",
      "status": "success",
      "message_id": "wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSMkE4OEJDMEM4RjA4NzY4OTMB",
      "timestamp": "2024-01-15T12:00:03Z"
    }
  ],
  "session_id": "user_123",
  "duration": "5.2 seconds"
}
```

## ⚠️ **Important Notes**

### Rate Limiting
- **Automatic delays**: 1-2 seconds between messages
- **WhatsApp limits**: Respect WhatsApp's rate limits
- **Recommendation**: Max 50 messages per request

### Phone Number Format
- **Required**: International format (+country_code)
- **Valid**: `+919876543210`
- **Invalid**: `9876543210`, `919876543210`

### Error Handling
- **Continues on failure**: Other messages still sent
- **Detailed errors**: Specific error for each failure
- **Audit trail**: All attempts logged

### Best Practices
1. **Test first**: Send to 1-2 numbers before bulk
2. **Validate numbers**: Ensure correct format
3. **Monitor logs**: Check for delivery issues
4. **Respect limits**: Don't exceed 50 messages per request
5. **Time appropriately**: Avoid sending during odd hours
