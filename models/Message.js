const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    receiver: {
        type: String,
        required: true
    },
    text: {
        type: String,
        default: ""
    },
    // Enhanced file field with full metadata
    file: {
        filename: {
            type: String,
            default: ""
        },
        originalName: {
            type: String,
            default: ""
        },
        size: {
            type: Number,
            default: 0
        },
        mimetype: {
            type: String,
            default: ""
        },
        url: {
            type: String,
            default: ""
        }
    },
    voice: {
        type: String,
        default: ""
    },
    voiceDuration: {
        type: Number,
        default: 0
    },
    type: {
        type: String,
        enum: ["text", "file", "voice", "image", "audio", "video"],
        default: "text"
    },
    // Legacy fields for backward compatibility
    fileType: {
        type: String,
        default: ""
    },
    fileName: {
        type: String,
        default: ""
    },
    reactions: {
        type: Object,
        default: {}
    },
    edited: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual property to check if message has file
MessageSchema.virtual('hasFile').get(function() {
    return this.file && this.file.filename && this.file.filename.length > 0;
});

// Virtual property to check file extension
MessageSchema.virtual('fileExtension').get(function() {
    if (!this.file || !this.file.originalName) return '';
    const parts = this.file.originalName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
});

// Virtual property to check if file is executable
MessageSchema.virtual('isExecutable').get(function() {
    return this.fileExtension === 'exe' || this.fileExtension === 'msi' || this.fileExtension === 'bat';
});

// Virtual property to get formatted file size
MessageSchema.virtual('formattedFileSize').get(function() {
    if (!this.file || !this.file.size) return '0 B';
    const bytes = this.file.size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
});

// Virtual property to get file icon based on type
MessageSchema.virtual('fileIcon').get(function() {
    if (!this.file || !this.file.originalName) return '📄';
    const ext = this.fileExtension;
    const icons = {
        'exe': '⚙️',
        'msi': '📦',
        'bat': '⚡',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'bmp': '🖼️',
        'svg': '🖼️',
        'webp': '🖼️',
        'mp3': '🎵',
        'wav': '🎵',
        'ogg': '🎵',
        'flac': '🎵',
        'mp4': '🎬',
        'avi': '🎬',
        'mov': '🎬',
        'wmv': '🎬',
        'mkv': '🎬',
        'zip': '📦',
        'rar': '📦',
        '7z': '📦',
        'tar': '📦',
        'gz': '📦',
        'pdf': '📕',
        'doc': '📘',
        'docx': '📘',
        'xls': '📊',
        'xlsx': '📊',
        'ppt': '📙',
        'pptx': '📙',
        'txt': '📝',
        'log': '📝',
        'js': '💻',
        'py': '💻',
        'java': '💻',
        'cpp': '💻',
        'c': '💻',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'xml': '📋',
        'yaml': '📋',
        'yml': '📋'
    };
    return icons[ext] || '📄';
});

// Virtual property to check if message contains media
MessageSchema.virtual('isMedia').get(function() {
    const mediaTypes = ['image', 'audio', 'video'];
    return mediaTypes.includes(this.type);
});

// Method to get download URL
MessageSchema.methods.getDownloadUrl = function() {
    if (!this.file || !this.file.filename) return null;
    return `/api/download/${this.file.filename}`;
};

// Static method to find messages by file
MessageSchema.statics.findByFile = function(filename) {
    return this.find({ 'file.filename': filename });
};

// Middleware to clean up file data when message is deleted
MessageSchema.pre('remove', async function(next) {
    // If there's a file, you might want to delete it from storage
    // This would require fs module and file path
    next();
});

// Ensure virtuals are included when converting to JSON
MessageSchema.set('toJSON', { virtuals: true });
MessageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Message", MessageSchema);