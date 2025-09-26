#!/bin/bash

# Script to test SMS reset and resend functionality
# Make sure you're logged into your app first

DOMAIN=${1:-"https://sandwich-project-platform-final-katielong2316.replit.app"}

echo "🔄 Testing SMS Reset and Resend Endpoints"
echo "Domain: $DOMAIN"
echo ""

# Function to make authenticated API calls
make_api_call() {
    local endpoint=$1
    local method=$2

    echo "📡 Calling $method $endpoint"

    # You need to be logged in with a session cookie for these to work
    curl -X $method "$DOMAIN$endpoint" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        --cookie-jar cookies.txt \
        --cookie cookies.txt \
        -w "\nHTTP Status: %{http_code}\n"

    echo ""
    echo "---"
    echo ""
}

echo "=== Step 1: Check current SMS status ==="
make_api_call "/api/users/sms-status" "GET"

echo ""
echo "=== Step 2: Reset SMS status (clear pending confirmation) ==="
read -p "Do you want to reset your SMS status? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    make_api_call "/api/users/sms-reset" "POST"
    echo "✅ SMS status has been reset!"
fi

echo ""
echo "=== Step 3: Or resend verification code ==="
read -p "Do you want to resend the verification code instead? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    make_api_call "/api/users/sms-resend" "POST"
    echo "📱 New verification code sent!"
fi

echo ""
echo "=== Done! ==="
echo "You can now:"
echo "1. Go back to the SMS opt-in page to start fresh"
echo "2. Check your phone for the new verification code"
echo "3. Reply with the code or 'YES' to confirm"

# Clean up
rm -f cookies.txt