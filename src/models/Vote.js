const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema(
	{
		targetType: {
			type: String,
			enum: ["post", "comment"],
			required: true,
		},
		targetId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		value: {
			type: Number,
			enum: [1, -1],
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

voteSchema.index({ targetType: 1, targetId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Vote", voteSchema);
