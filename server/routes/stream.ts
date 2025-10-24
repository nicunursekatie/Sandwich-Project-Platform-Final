import { Router } from 'express';
import { StreamChat } from 'stream-chat';
import { logger } from '../../utils/production-safe-logger';

export const streamRoutes = Router();

// Initialize Stream Chat server client (server-side only)
let streamServerClient: StreamChat | null = null;

const initializeStreamServer = () => {
  try {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.log('Stream Chat credentials not found in environment variables');
      return null;
    }

    streamServerClient = StreamChat.getInstance(apiKey, apiSecret);
    return streamServerClient;
  } catch (error) {
    logger.error('Failed to initialize Stream Chat server:', error);
    return null;
  }
};

// Get Stream Chat credentials and generate user token
streamRoutes.post('/credentials', async (req, res) => {
  try {
    logger.log('=== STREAM CREDENTIALS ENDPOINT ===');
    logger.log('User from req.user:', req.user);
    logger.log('User from session:', req.session?.user);
    logger.log('Session exists:', !!req.session);
    logger.log('Session ID:', req.sessionID);

    const user = req.user || req.session?.user;
    if (!user) {
      logger.log('❌ No user found in request or session');
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.log('✅ User authenticated:', user.email);

    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'Stream Chat not configured',
        message:
          'Please add STREAM_API_KEY and STREAM_API_SECRET to environment variables',
      });
    }

    // Initialize server client if not already done
    if (!streamServerClient) {
      streamServerClient = initializeStreamServer();
      if (!streamServerClient) {
        return res
          .status(500)
          .json({ error: 'Failed to initialize Stream Chat' });
      }
    }

    // Create Stream user ID based on app user ID
    const streamUserId = `user_${user.id}`;

    try {
      // Map user roles to valid Stream Chat roles
      const userRole = user.role;
      let streamRole = 'user'; // default
      
      // Map app roles to Stream Chat roles
      if (userRole === 'admin' || userRole === 'admin_coordinator' || userRole === 'super_admin') {
        streamRole = 'admin';
      } else if (userRole === 'volunteer' || userRole === 'viewer') {
        streamRole = 'user';
      }

      logger.log(`🔧 Stream Chat role mapping: ${userRole} -> ${streamRole} for user ${user.email}`);

      // Create or update user in Stream
      await streamServerClient.upsertUser({
        id: streamUserId,
        name: `${user.firstName} ${user.lastName}` || user.email,
        email: user.email,
        role: streamRole,
      });

      // Also create test users for multi-user conversations
      const testUsers = [
        { id: 'test-user-2', name: 'Test User', email: 'test@example.com' },
        { id: 'admin-user', name: 'Admin User', email: 'admin@example.com' },
        { id: 'demo-user-1', name: 'Demo User 1', email: 'demo1@example.com' },
        { id: 'demo-user-2', name: 'Demo User 2', email: 'demo2@example.com' },
      ];

      for (const testUser of testUsers) {
        await streamServerClient
          .upsertUser({
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            role: 'user',
          })
          .catch(() => {
            // Ignore if user already exists
          });
      }

      // Generate user token
      const userToken = streamServerClient.createToken(streamUserId);

      // Initialize team chat rooms based on user permissions
      const teamRooms = [
        { id: 'general', name: 'General Chat', permission: 'CHAT_GENERAL' },
        { id: 'core-team', name: 'Core Team', permission: 'CHAT_CORE_TEAM' },
        { id: 'grants-committee', name: 'Grants Committee', permission: 'CHAT_GRANTS_COMMITTEE' },
        { id: 'events-committee', name: 'Events Committee', permission: 'CHAT_EVENTS_COMMITTEE' },
        { id: 'board-chat', name: 'Board Chat', permission: 'CHAT_BOARD' },
        { id: 'web-committee', name: 'Web Committee', permission: 'CHAT_WEB_COMMITTEE' },
        { id: 'volunteer-management', name: 'Volunteer Management', permission: 'CHAT_VOLUNTEER_MANAGEMENT' },
        { id: 'host', name: 'Host Chat', permission: 'CHAT_HOST' },
        { id: 'driver', name: 'Driver Chat', permission: 'CHAT_DRIVER' },
        { id: 'recipient', name: 'Recipient Chat', permission: 'CHAT_RECIPIENT' },
      ];

      // Create team channels that the user has permission for AND add user as member
      const userPermissions = user.permissions || [];
      logger.log(`🔍 Processing channels for ${user.email}, permissions:`, userPermissions);

      for (const room of teamRooms) {
        if (userPermissions.includes(room.permission)) {
          logger.log(`✓ User has permission ${room.permission}, setting up channel ${room.id}`);
          try {
            // Get or create the channel
            const channel = streamServerClient.channel('team', room.id, {
              name: room.name,
              created_by_id: streamUserId,
            });

            // Use getOrCreate to handle both new and existing channels
            await channel.getOrCreate();

            // Add user as member (this works for both new and existing channels)
            try {
              await channel.addMembers([streamUserId]);
              logger.log(`✅ Added ${user.email} to channel ${room.id}`);
            } catch (addError: any) {
              // User might already be a member
              if (addError.message?.includes('already a member')) {
                logger.log(`User ${user.email} already in channel ${room.id}`);
              } else {
                logger.error(`Failed to add user to ${room.id}:`, addError.message);
              }
            }
          } catch (channelError: any) {
            logger.error(`Failed to setup channel ${room.id}:`, channelError.message);
          }
        }
      }

      res.json({
        apiKey,
        userToken,
        streamUserId,
      });
    } catch (streamError) {
      logger.error('❌ Stream Chat user creation error:', streamError);
      res.status(500).json({
        error: 'Failed to create Stream user',
        message:
          streamError.message ||
          'Check Stream Chat credentials and network connectivity',
      });
    }
  } catch (error) {
    logger.error('❌ Stream credentials error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Create a channel for messaging
streamRoutes.post('/channels', async (req, res) => {
  try {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { participants, channelType = 'messaging' } = req.body;

    if (!streamServerClient) {
      return res.status(500).json({ error: 'Stream Chat not initialized' });
    }

    const streamUserId = `user_${user.id}`;

    // Create channel
    const channel = streamServerClient.channel(channelType, {
      members: [streamUserId, ...participants.map((p: string) => `user_${p}`)],
      created_by_id: streamUserId,
    });

    await channel.create();

    res.json({
      channelId: channel.id,
      channelType: channel.type,
      members: channel.data?.members || [],
    });
  } catch (error) {
    logger.error('Channel creation error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});
