# Vaiform Mobile Spec Pack

This file contains the mobile API specification for the Vaiform backend.

## TODO: Paste your Mobile Spec Pack here

Once you paste the specification, update the API client and screens to wire up the real endpoints.

---

## Current Placeholder Endpoints

The mobile app currently uses these endpoints:

### Health Check
- **GET** `/health`
- No authentication required
- Returns: JSON with server status

---

## Endpoints to Implement

Add your endpoint specifications below. Include:

1. **Authentication Endpoints**
   - POST /auth/register
   - POST /auth/login
   - POST /auth/logout
   - GET /auth/me

2. **Forms Endpoints**
   - GET /forms - List user's forms
   - POST /forms - Create a new form
   - GET /forms/:id - Get form details
   - PUT /forms/:id - Update form
   - DELETE /forms/:id - Delete form

3. **Submissions Endpoints**
   - GET /forms/:id/submissions - List form submissions
   - POST /forms/:id/submissions - Create submission
   - GET /submissions/:id - Get submission details

4. **Credits/Billing Endpoints**
   - GET /credits - Get user's credit balance
   - GET /credits/history - Get credit usage history

---

## API Response Format

Document your standard API response format here:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 401  | Unauthorized - Invalid or expired token |
| 429  | Rate limited - Too many requests |
| 5xx  | Server error - Something went wrong |

---

## Notes

- All authenticated endpoints require `Authorization: Bearer <firebase_id_token>` header
- The `x-client: mobile` header is sent with all requests for analytics/logging
