import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'tacksharp',
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Creating FollowUp table...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS FollowUp (
      id VARCHAR(191) NOT NULL,
      organizationId VARCHAR(191) NOT NULL,
      leadId VARCHAR(191) NOT NULL,
      customerId VARCHAR(191) NOT NULL,

      channel VARCHAR(191) NOT NULL DEFAULT 'whatsapp',
      action VARCHAR(191) NOT NULL DEFAULT 'message',
      message TEXT NULL,

      scheduledAt DATETIME(3) NOT NULL,
      status VARCHAR(191) NOT NULL DEFAULT 'scheduled',

      attempts INT NOT NULL DEFAULT 0,
      cancellationReason VARCHAR(191) NULL,

      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,

      PRIMARY KEY (id),

      INDEX FollowUp_organizationId_idx (organizationId),
      INDEX FollowUp_organizationId_scheduledAt_idx (
        organizationId,
        scheduledAt
      ),
      INDEX FollowUp_organizationId_status_idx (
        organizationId,
        status
      ),
      INDEX FollowUp_leadId_idx (leadId),
      INDEX FollowUp_customerId_idx (customerId),

      CONSTRAINT FollowUp_organizationId_fkey
        FOREIGN KEY (organizationId)
        REFERENCES Organization(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

      CONSTRAINT FollowUp_leadId_fkey
        FOREIGN KEY (leadId)
        REFERENCES Lead(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

      CONSTRAINT FollowUp_customerId_fkey
        FOREIGN KEY (customerId)
        REFERENCES Customer(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('FollowUp table created successfully.');
}

main()
  .catch((error) => {
    console.error('FAILED TO CREATE FOLLOW-UP TABLE');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
