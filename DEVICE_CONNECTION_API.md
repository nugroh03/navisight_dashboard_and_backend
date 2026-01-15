# Device Connection API Documentation

## Mobile App - Connect Device to Project

### Endpoint
```
POST /api/mobile/projects/connect-device
```

### Authentication
Requires Bearer token in Authorization header:
```
Authorization: Bearer <JWT_TOKEN>
```

### Request Body
```json
{
  "projectId": "uuid-project-id",
  "deviceId": "unique-device-identifier"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Device connected successfully",
  "project": {
    "id": "uuid",
    "name": "Project Name",
    "deviceId": "unique-device-identifier",
    "updatedAt": "2025-12-25T..."
  }
}
```

### Error Responses

#### 400 - Validation Error
```json
{
  "error": "Validation failed",
  "details": {
    "projectId": ["Invalid project ID"],
    "deviceId": ["Device ID is required"]
  }
}
```

#### 404 - Project Not Found
```json
{
  "error": "Project not found or access denied"
}
```

#### 409 - Device Already Connected
```json
{
  "error": "Device ID already connected to another project",
  "message": "This device is already registered to a different project"
}
```

---

## Dashboard - Get Device Info

### Endpoint
```
GET /api/projects/{projectId}/device-info
```

### Authentication
Requires NextAuth session (cookie-based)

### Success Response (200)
```json
{
  "deviceId": "unique-device-identifier",
  "isConnected": true,
  "lastReportedAt": "2025-12-25T10:30:00Z",
  "lastPosition": {
    "latitude": -6.123456,
    "longitude": 106.123456
  },
  "connectedUsers": [
    {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "accountType": "INTERNAL_STAFF",
      "role": "ADMIN"
    }
  ]
}
```

---

## Dashboard - Update Project (with Device ID)

### Endpoint
```
PUT /api/projects/{projectId}
```

### Authentication
Requires NextAuth session (cookie-based)

### Request Body
```json
{
  "name": "Updated Project Name",
  "deviceId": "optional-device-identifier"
}
```

### Success Response (200)
```json
{
  "id": "uuid",
  "name": "Updated Project Name",
  "deviceId": "optional-device-identifier",
  "createdAt": "2025-12-20T...",
  "updatedAt": "2025-12-25T...",
  "deletedAt": null
}
```

---

## Flutter Integration Example

```dart
Future<void> connectDevice(String projectId, String deviceId) async {
  final token = await getStoredToken(); // Get JWT token from storage
  
  final response = await http.post(
    Uri.parse('$baseUrl/api/mobile/projects/connect-device'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'projectId': projectId,
      'deviceId': deviceId,
    }),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    print('Device connected: ${data['message']}');
  } else {
    final error = jsonDecode(response.body);
    throw Exception(error['error']);
  }
}
```

---

## Features

### Dashboard (Web)
- ✅ Edit project form menampilkan field Device ID
- ✅ Menampilkan status device (connected/not connected)
- ✅ Menampilkan last reported time
- ✅ Menampilkan list users yang terhubung dengan project
- ✅ Menampilkan role dan account type setiap user

### Mobile App
- ✅ Endpoint untuk connect device ID ke project
- ✅ Validasi user harus punya akses ke project
- ✅ Validasi device ID tidak boleh digunakan oleh project lain
- ✅ Support JWT Bearer token authentication

---

## Security Notes

1. **Mobile Endpoint** (`/api/mobile/projects/connect-device`):
   - Requires valid JWT token from mobile login
   - User must be a member of the project
   - Device ID must be unique across projects

2. **Dashboard Endpoints**:
   - Requires NextAuth session (cookie-based)
   - User must have access to the project
   - Device info only visible to project members

3. **Device ID Uniqueness**:
   - One device can only be connected to one project at a time
   - Attempting to connect to multiple projects returns 409 error
