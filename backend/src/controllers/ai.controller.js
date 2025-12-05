const aiService = require('../services/ai.service');

module.exports.getReview = async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });

  try {
    const text = await aiService.main(`Review this code:\n${code}`);
    return res.json({ review: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
