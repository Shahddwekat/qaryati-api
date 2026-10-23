-- Local development only: lets Prisma create its temporary "shadow" database during migrations.
GRANT ALL PRIVILEGES ON *.* TO 'qaryati'@'%';
FLUSH PRIVILEGES;