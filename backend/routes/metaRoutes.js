const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/dependencies', async (req, res) => {
  try {
    const { data } = await axios.get('https://start.spring.io/metadata/client');
    const simplified = data.dependencies.values.flatMap(group =>
      group.values.map(dep => ({
        id: dep.id,
        name: dep.name.toLowerCase() + ' (' + dep.id + ')'
      }))
    );
    res.json(simplified);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dependency metadata' });
  }
});

module.exports = router;
