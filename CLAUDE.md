# Cats N Cards TCG Portal

## Project Overview
Cats N Cards TCG Portal is a comprehensive LINE LIFF-based web application for a Pokemon Trading Card Game business. The portal provides customers with a seamless experience for points management, live streaming, delivery requests, and payment processing with automatic receipt verification.

## Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript** - Responsive web application
- **LINE LIFF SDK** - LINE platform integration for user authentication and messaging
- **Firebase SDK** (v9.22.0) - Real-time database, authentication, storage, and Firestore
- **Responsive Design** - Mobile-first approach with desktop compatibility

### Backend
- **Firebase Cloud Functions** (Node.js 18) - Serverless backend logic
- **Firebase Firestore** - NoSQL document database for data storage
- **Firebase Storage** - File storage for receipts and images
- **Firebase Authentication** - User authentication system
- **Thunder API** - Third-party receipt verification service

### Key Features
1. **Points System** - Customer loyalty and rewards tracking
2. **Live Streaming** - Integration with live content delivery
3. **Delivery Management** - Package delivery request system
4. **Payment Processing** - Multi-method payment handling with receipt verification
5. **Admin Dashboard** - Stream administration and analytics

## Project Structure

```
cats-n-cards-portal/
├── index.html                  # Main portal entry point
├── points.html                 # Points and rewards page
├── live.html                   # Live streaming page
├── delivery.html               # Delivery request page
├── payment.html                # Payment processing page
├── auth.html                   # Firebase authentication page
├── firebase-auth.html          # Alternative auth page
├── stream-admin-2024.html      # Admin dashboard
├── setup-payment-methods.html  # Payment method configuration
├──
├── js/                         # JavaScript modules
├── functions/                  # Firebase Cloud Functions
│   ├── index.js               # Main functions file
│   ├── thunder-api.js         # Receipt verification integration
│   └── package.json           # Functions dependencies
├──
├── firebase.json              # Firebase configuration
├── firestore.rules            # Firestore security rules
├── firebase-config.js         # Firebase initialization
├── liff-init.js              # LINE LIFF initialization
├── user-mapping.js           # User mapping utilities
├──
└── Documentation/
    ├── DEPLOYMENT.md          # Deployment instructions
    ├── SETUP_GUIDE.md         # Setup guide
    └── LINE_MENU_SETUP.md     # LINE integration guide
```

## Core Modules

### 1. LINE LIFF Integration (`liff-init.js`)
- Initializes LINE LIFF SDK
- Handles user authentication within LINE
- Provides user profile data
- Manages LIFF context and state

### 2. Firebase Integration (`firebase-config.js`)
- Firebase SDK initialization
- Database connectivity setup
- Authentication configuration
- Storage integration

### 3. User Mapping (`user-mapping.js`)
- Maps LINE user IDs to Firebase users
- Handles user profile synchronization
- Manages user data consistency

### 4. Cloud Functions (`functions/index.js`)
- **Receipt Verification**: Automated receipt processing via Thunder API
- **Payment Methods**: CRUD operations for payment methods
- **User Management**: User-related operations
- **File Processing**: Image upload and processing

### 5. Payment Processing
- Multiple payment method support
- Automatic receipt verification
- Points calculation and awarding
- Transaction status tracking

## Key Files and Their Purposes

### Main Application Pages
- `index.html` - Main portal with navigation menu
- `points.html` - Points balance and rewards system
- `live.html` - Live streaming integration
- `delivery.html` - Delivery request management
- `payment.html` - Payment processing interface

### JavaScript Modules
- `liff-init.js` - LINE LIFF SDK initialization and management
- `firebase-config.js` - Firebase configuration and initialization
- `user-mapping.js` - User identity mapping between LINE and Firebase
- `payment-methods.js` - Payment method management
- `dashboard.js` - Admin dashboard functionality

### Configuration Files
- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules
- `functions/package.json` - Cloud Functions dependencies

## Deployment

### Firebase Hosting
The web application is deployed on Firebase Hosting with automatic SSL and CDN distribution.

### Cloud Functions
Backend functions are deployed to Firebase Cloud Functions in the Asia Southeast region for optimal performance.

### Storage
Images and receipts are stored in Firebase Storage with appropriate security rules.

## Security Features

1. **Firebase Authentication** - Secure user authentication
2. **Firestore Security Rules** - Database access control
3. **Cloud Functions Security** - Server-side validation and processing
4. **LINE Security** - LIFF SDK security features
5. **CORS Configuration** - Proper cross-origin resource sharing setup

## Development Workflow

### Local Development
1. Use Firebase emulators for local testing
2. Test LIFF functionality in LINE browser
3. Use Firebase Functions shell for backend testing

### Deployment Process
1. Test in staging environment
2. Run Firebase deployment commands
3. Verify all endpoints are functioning
4. Monitor logs and performance

### Monitoring
- Firebase Console for analytics
- Cloud Functions logs for debugging
- Performance monitoring through Firebase A/B Testing

## APIs and Integrations

### LINE Platform
- LIFF SDK for user authentication
- Messaging API for notifications
- User profile access

### Thunder API
- Receipt verification service
- Transaction validation
- Automated data extraction

### Firebase Services
- Firestore for real-time data
- Authentication for user management
- Storage for file handling
- Cloud Functions for serverless backend

## Configuration Requirements

### Environment Variables
- Firebase project configuration
- Thunder API authentication token
- LINE LIFF application settings

### Firebase Rules
- Properly configured Firestore rules
- Storage security rules
- Authentication providers setup

## Future Enhancements

1. **Enhanced Analytics** - Advanced user behavior tracking
2. **Push Notifications** - Real-time customer engagement
3. **Advanced Dashboard** - More admin features
4. **Mobile App** - Native mobile application
5. **API Documentation** - Comprehensive API reference

## Support and Maintenance

### Regular Tasks
- Monitor Firebase usage and billing
- Update dependencies
- Review security rules
- Check LIFF API updates

### Troubleshooting
- Check Firebase Functions logs
- Verify LIFF configuration
- Test authentication flow
- Monitor API rate limits

## Contact Information

- **Project Name**: Cats N Cards TCG Portal
- **Business**: Pokemon Trading Card Game retail
- **Primary Platform**: LINE LIFF Application
- **Backend**: Firebase Cloud Functions
- **TikTok**: @cats.n.cards.live