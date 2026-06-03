const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../modules/user/user.model');
const Role = require('../modules/role/role.model');

async function assignLeaderRole() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find the Leader role
        const leaderRole = await Role.findOne({ name: 'leader' });
        if (!leaderRole) {
            console.error('❌ Leader role not found. Please run seed-roles.js first.');
            process.exit(1);
        }
        console.log('✅ Found Leader role:', leaderRole.displayName);

        // Find the admin user
        const adminEmail = 'cao343451@gmail.com';
        const admin = await User.findOne({ email: adminEmail });

        if (!admin) {
            console.error(`❌ Admin user with email ${adminEmail} not found.`);
            process.exit(1);
        }
        console.log('✅ Found admin user:', admin.fullName);

        // Check if already has the role
        if (admin.roleId && admin.roleId.toString() === leaderRole._id.toString()) {
            console.log('ℹ️  Admin already has Leader role assigned.');
        } else {
            // Assign the Leader role
            admin.roleId = leaderRole._id;
            await admin.save();
            console.log('✅ Successfully assigned Leader role to', admin.fullName);
        }

        // Display final state
        const updatedAdmin = await User.findById(admin._id).populate('roleId');
        console.log('\n📋 Final admin state:');
        console.log('   Name:', updatedAdmin.fullName);
        console.log('   Email:', updatedAdmin.email);
        console.log('   Role:', updatedAdmin.role);
        console.log('   RoleId:', updatedAdmin.roleId ? updatedAdmin.roleId.displayName : 'None');
        console.log('   Permissions:', updatedAdmin.roleId ? updatedAdmin.roleId.permissions.length : 0);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

assignLeaderRole();