/**
 * Development Database Seeding Script
 *
 * This script populates the development database with realistic sample data
 * for testing and development purposes.
 *
 * Usage:
 *   npm run db:seed
 *
 * To reset and reseed:
 *   npm run db:reset
 */

import { db } from '../server/db.js';
import * as schema from '../shared/schema.js';
import bcrypt from 'bcrypt';

/**
 * Generate sample users with different roles
 */
async function seedUsers() {
  console.log('🌱 Seeding users...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    {
      id: 'admin-001',
      email: 'admin@sandwich.dev',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin',
      role: 'admin',
      isActive: true,
      phoneNumber: '555-0100',
      preferredEmail: 'admin@sandwich.dev',
    },
    {
      id: 'coordinator-001',
      email: 'coordinator@sandwich.dev',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Coordinator',
      displayName: 'Jane C',
      role: 'admin_coordinator',
      isActive: true,
      phoneNumber: '555-0101',
      preferredEmail: 'coordinator@sandwich.dev',
    },
    {
      id: 'volunteer-001',
      email: 'volunteer1@sandwich.dev',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Volunteer',
      displayName: 'John V',
      role: 'volunteer',
      isActive: true,
      phoneNumber: '555-0102',
      preferredEmail: 'volunteer1@sandwich.dev',
    },
    {
      id: 'volunteer-002',
      email: 'volunteer2@sandwich.dev',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Helper',
      displayName: 'Sarah H',
      role: 'volunteer',
      isActive: true,
      phoneNumber: '555-0103',
      preferredEmail: 'volunteer2@sandwich.dev',
    },
    {
      id: 'driver-001',
      email: 'driver@sandwich.dev',
      password: hashedPassword,
      firstName: 'Mike',
      lastName: 'Driver',
      displayName: 'Mike D',
      role: 'volunteer',
      isActive: true,
      phoneNumber: '555-0104',
      preferredEmail: 'driver@sandwich.dev',
    },
  ];

  await db.insert(schema.users).values(users).onConflictDoNothing();
  console.log(`✅ Created ${users.length} users`);
}

/**
 * Generate sample projects
 */
async function seedProjects() {
  console.log('🌱 Seeding projects...');

  const projects = [
    {
      name: 'Thanksgiving Meal Drive 2025',
      description: 'Annual Thanksgiving meal distribution to families in need',
      status: 'in-progress',
      priority: 'high',
      startDate: new Date('2025-11-01'),
      dueDate: new Date('2025-11-28'),
      createdBy: 'admin-001',
    },
    {
      name: 'Winter Coat Collection',
      description: 'Collecting and distributing winter coats to homeless shelters',
      status: 'planning',
      priority: 'medium',
      startDate: new Date('2025-11-15'),
      dueDate: new Date('2025-12-20'),
      createdBy: 'coordinator-001',
    },
    {
      name: 'Weekly Sandwich Distribution - Route A',
      description: 'Regular sandwich distribution for downtown area',
      status: 'in-progress',
      priority: 'high',
      startDate: new Date('2025-10-01'),
      dueDate: new Date('2025-12-31'),
      createdBy: 'admin-001',
    },
  ];

  await db.insert(schema.projects).values(projects).onConflictDoNothing();
  console.log(`✅ Created ${projects.length} projects`);
}

/**
 * Generate sample hosts
 */
async function seedHosts() {
  console.log('🌱 Seeding hosts...');

  const hosts = [
    {
      name: 'Community Center North',
      address: '123 Main St, Cityville',
      latitude: '40.7128',
      longitude: '-74.0060',
      isActive: true,
    },
    {
      name: 'Shelter House South',
      address: '456 Oak Ave, Cityville',
      latitude: '40.7589',
      longitude: '-73.9851',
      isActive: true,
    },
    {
      name: 'Faith Community Church',
      address: '789 Elm St, Cityville',
      latitude: '40.7614',
      longitude: '-73.9776',
      isActive: true,
    },
  ];

  const insertedHosts = await db.insert(schema.hosts).values(hosts).returning();
  console.log(`✅ Created ${insertedHosts.length} hosts`);
  return insertedHosts;
}

/**
 * Generate sample drivers
 */
async function seedDrivers() {
  console.log('🌱 Seeding drivers...');

  const drivers = [
    {
      name: 'Mike Driver',
      email: 'driver@sandwich.dev',
      phone: '555-0104',
      isActive: true,
      vehicleInfo: 'Honda Civic - Blue',
      notes: 'Available weekdays',
    },
    {
      name: 'Lisa Transport',
      email: 'lisa@sandwich.dev',
      phone: '555-0105',
      isActive: true,
      vehicleInfo: 'Toyota Camry - Silver',
      notes: 'Prefers weekend deliveries',
    },
  ];

  const insertedDrivers = await db.insert(schema.drivers).values(drivers).returning();
  console.log(`✅ Created ${insertedDrivers.length} drivers`);
  return insertedDrivers;
}

/**
 * Generate sample recipients
 */
async function seedRecipients() {
  console.log('🌱 Seeding recipients...');

  const recipients = [
    {
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria.g@example.com',
      phone: '555-0200',
      address: '100 First St, Apt 2B',
      city: 'Cityville',
      state: 'NY',
      zipCode: '10001',
      householdSize: 4,
      dietary: 'None',
      isActive: true,
    },
    {
      firstName: 'Robert',
      lastName: 'Johnson',
      email: 'robert.j@example.com',
      phone: '555-0201',
      address: '200 Second Ave',
      city: 'Cityville',
      state: 'NY',
      zipCode: '10002',
      householdSize: 2,
      dietary: 'Vegetarian',
      isActive: true,
    },
    {
      firstName: 'Chen',
      lastName: 'Wei',
      phone: '555-0202',
      address: '300 Third Blvd, Unit 5',
      city: 'Cityville',
      state: 'NY',
      zipCode: '10003',
      householdSize: 3,
      dietary: 'Halal',
      isActive: true,
    },
  ];

  const insertedRecipients = await db.insert(schema.recipients).values(recipients).returning();
  console.log(`✅ Created ${insertedRecipients.length} recipients`);
  return insertedRecipients;
}

/**
 * Generate sample sandwich distributions
 */
async function seedSandwichDistributions(hosts: any[]) {
  console.log('🌱 Seeding sandwich distributions...');

  const distributions = [
    {
      date: new Date('2025-10-20'),
      hostId: hosts[0].id,
      sandwichCount: 50,
      recipientCount: 25,
      status: 'completed',
      notes: 'Great turnout, ran out early',
    },
    {
      date: new Date('2025-10-21'),
      hostId: hosts[1].id,
      sandwichCount: 40,
      recipientCount: 20,
      status: 'completed',
      notes: 'Smooth distribution',
    },
    {
      date: new Date('2025-10-27'),
      hostId: hosts[0].id,
      sandwichCount: 60,
      recipientCount: 0,
      status: 'scheduled',
      notes: 'Expecting high demand',
    },
  ];

  await db.insert(schema.sandwichDistributions).values(distributions).onConflictDoNothing();
  console.log(`✅ Created ${distributions.length} sandwich distributions`);
}

/**
 * Generate sample chat messages
 */
async function seedChatMessages() {
  console.log('🌱 Seeding chat messages...');

  const messages = [
    {
      channel: 'general',
      userId: 'admin-001',
      userName: 'Admin User',
      content: 'Welcome to the Sandwich Project Platform! 🥪',
    },
    {
      channel: 'general',
      userId: 'volunteer-001',
      userName: 'John V',
      content: 'Happy to be here! Looking forward to helping out.',
    },
    {
      channel: 'core-team',
      userId: 'coordinator-001',
      userName: 'Jane C',
      content: 'Team meeting scheduled for next Tuesday at 2 PM',
    },
    {
      channel: 'driver',
      userId: 'driver-001',
      userName: 'Mike D',
      content: 'Available for deliveries this weekend',
    },
  ];

  await db.insert(schema.chatMessages).values(messages).onConflictDoNothing();
  console.log(`✅ Created ${messages.length} chat messages`);
}

/**
 * Generate sample team board items
 */
async function seedTeamBoardItems() {
  console.log('🌱 Seeding team board items...');

  const items = [
    {
      title: 'Need volunteers for Saturday distribution',
      description: 'Looking for 5 volunteers to help with sandwich prep and distribution',
      type: 'request',
      status: 'open',
      createdBy: 'coordinator-001',
      createdByName: 'Jane Coordinator',
    },
    {
      title: 'Extra coolers available',
      description: 'We have 3 extra coolers in storage if anyone needs them',
      type: 'offer',
      status: 'open',
      createdBy: 'volunteer-001',
      createdByName: 'John Volunteer',
    },
    {
      title: 'Transportation needed for next week',
      description: 'Need a driver for the downtown route next Wednesday',
      type: 'request',
      status: 'open',
      createdBy: 'admin-001',
      createdByName: 'Admin User',
    },
  ];

  await db.insert(schema.teamBoardItems).values(items).onConflictDoNothing();
  console.log(`✅ Created ${items.length} team board items`);
}

/**
 * Generate sample announcements
 */
async function seedAnnouncements() {
  console.log('🌱 Seeding announcements...');

  const announcements = [
    {
      title: 'Holiday Schedule Updated',
      content: 'Please check the updated holiday distribution schedule in the calendar',
      priority: 'high',
      userId: 'admin-001',
      userName: 'Admin User',
      isActive: true,
    },
    {
      title: 'New Safety Guidelines',
      content: 'Updated COVID-19 safety protocols are now available in the documents section',
      priority: 'medium',
      userId: 'coordinator-001',
      userName: 'Jane Coordinator',
      isActive: true,
    },
  ];

  await db.insert(schema.announcements).values(announcements).onConflictDoNothing();
  console.log(`✅ Created ${announcements.length} announcements`);
}

/**
 * Main seeding function
 */
async function main() {
  try {
    console.log('🚀 Starting database seeding...\n');

    await seedUsers();
    await seedProjects();
    const hosts = await seedHosts();
    await seedDrivers();
    await seedRecipients();
    await seedSandwichDistributions(hosts);
    await seedChatMessages();
    await seedTeamBoardItems();
    await seedAnnouncements();

    console.log('\n✨ Database seeding completed successfully!');
    console.log('\n📝 Test credentials:');
    console.log('   Admin:       admin@sandwich.dev / password123');
    console.log('   Coordinator: coordinator@sandwich.dev / password123');
    console.log('   Volunteer:   volunteer1@sandwich.dev / password123');
    console.log('   Driver:      driver@sandwich.dev / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main();
