const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../modules/role/role.model');

dotenv.config();

const defaultRoles = [
    {
        name: 'leader',
        displayName: 'Leader',
        description: 'Admin chính với toàn quyền quản trị hệ thống',
        permissions: [
            'dashboard.view',
            'blog.view',
            'blog.create',
            'blog.edit',
            'blog.delete',
            'blog.approve',
            'faq.view',
            'faq.create',
            'faq.edit',
            'faq.delete',
            'faq.answer',
            'hotroduan.view',
            'hotroduan.create',
            'hotroduan.edit',
            'hotroduan.delete',
            'hotroduan.answer',
            'users.view',
            'users.edit',
            'users.ban',
            'users.delete',
            'comments.view',
            'comments.delete',
            'settings.view',
            'settings.edit',
            'roles.view',
            'roles.create',
            'roles.edit',
            'roles.delete',
            'admins.view',
            'admins.create',
            'admins.edit',
            'admins.delete'
        ],
        isSystem: true
    }
];

const seedRoles = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🌱 Seeding roles...');

        for (const roleData of defaultRoles) {
            const existing = await Role.findOne({ name: roleData.name });
            if (existing) {
                console.log(`⚠️  Role "${roleData.name}" already exists, skipping...`);
                continue;
            }

            const role = new Role(roleData);
            await role.save();
            console.log(`✅ Created role: ${roleData.displayName}`);
        }

        console.log('✅ Seeding completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedRoles();