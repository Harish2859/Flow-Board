require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const pool = require('./db');
const { signToken, requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, display_name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const id = uuid();
    const name = display_name || email.split('@')[0];
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, display_name, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, email, display_name`,
      [id, email.toLowerCase(), name, hash]
    );
    const user = rows[0];
    res.json({ token: signToken({ id: user.id, email: user.email }), user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password_hash, ...safe } = user;
    res.json({ token: signToken({ id: safe.id, email: safe.email }), user: safe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, display_name FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// ── Boards ────────────────────────────────────────────────────────────────────

app.get('/api/boards', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, b.owner_id, b.created_at,
              COUNT(bm2.user_id)::int AS member_count
       FROM boards b
       JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
       JOIN board_members bm2 ON bm2.board_id = b.id
       GROUP BY b.id
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/boards', requireAuth, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = uuid();
    const { rows } = await client.query(
      'INSERT INTO boards (id, title, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [id, title, req.user.id]
    );
    await client.query(
      "INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'admin')",
      [id, req.user.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get('/api/boards/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, b.owner_id, bm.role
       FROM boards b
       LEFT JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $2
       WHERE b.id = $1`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Board not found' });
    const board = rows[0];
    // If owner has no membership row yet, auto-insert it
    if (!board.role && board.owner_id === req.user.id) {
      await pool.query(
        `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'admin')
         ON CONFLICT (board_id, user_id) DO NOTHING`,
        [req.params.id, req.user.id]
      );
      board.role = 'admin';
    }
    // Non-member, non-owner trying to access
    if (!board.role) return res.status(403).json({ error: 'Access denied' });
    res.json(board);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/boards/:id', requireAuth, async (req, res) => {
  const { title } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE boards SET title = $1 WHERE id = $2
       AND EXISTS (SELECT 1 FROM board_members WHERE board_id = $2 AND user_id = $3 AND role IN ('admin','editor'))
       RETURNING *`,
      [title, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Board Members ─────────────────────────────────────────────────────────────

app.get('/api/boards/:id/members', requireAuth, async (req, res) => {
  try {
    const { rows: access } = await pool.query(
      `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2
       UNION SELECT 1 FROM boards WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });
    const { rows } = await pool.query(
      `SELECT bm.user_id, bm.role, u.id, u.email, u.display_name
       FROM board_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.board_id = $1`,
      [req.params.id]
    );
    res.json(rows.map(r => ({
      user_id: r.user_id,
      role: r.role,
      profile: { id: r.id, email: r.email, display_name: r.display_name },
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/boards/:id/members', requireAuth, async (req, res) => {
  const { email, role = 'editor' } = req.body;
  try {
    const { rows: profiles } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (!profiles[0]) return res.status(404).json({ error: 'User not registered' });
    await pool.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO NOTHING`,
      [req.params.id, profiles[0].id, role]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Columns ───────────────────────────────────────────────────────────────────

app.get('/api/boards/:id/columns', requireAuth, async (req, res) => {
  try {
    // Check access first
    const { rows: access } = await pool.query(
      `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2
       UNION SELECT 1 FROM boards WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });
    const { rows } = await pool.query(
      `SELECT * FROM columns WHERE board_id = $1 ORDER BY position`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/boards/:id/columns', requireAuth, async (req, res) => {
  const { title, position } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO columns (id, board_id, title, position)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [uuid(), req.params.id, title, position]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/columns/:id', requireAuth, async (req, res) => {
  const fields = [];
  const vals = [];
  let i = 1;
  if (req.body.title !== undefined) { fields.push(`title = $${i++}`); vals.push(req.body.title); }
  if (req.body.position !== undefined) { fields.push(`position = $${i++}`); vals.push(req.body.position); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE columns SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/api/boards/:id/tasks', requireAuth, async (req, res) => {
  try {
    const { rows: access } = await pool.query(
      `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2
       UNION SELECT 1 FROM boards WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!access.length) return res.status(403).json({ error: 'Access denied' });
    const { rows } = await pool.query(
      `SELECT t.* FROM tasks t
       JOIN columns c ON c.id = t.column_id
       WHERE c.board_id = $1
       ORDER BY t.position`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const { column_id, title, position, priority = 'medium' } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (id, column_id, title, position, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuid(), column_id, title, position, priority]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  const allowed = ['title', 'description', 'priority', 'assigned_to', 'column_id', 'position'];
  const fields = [];
  const vals = [];
  let i = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = $${i++}`);
      vals.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  fields.push(`updated_at = NOW()`);
  vals.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Bulk position update ──────────────────────────────────────────────────────

app.post('/api/tasks/reorder', requireAuth, async (req, res) => {
  // [{ id, column_id, position }]
  const updates = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query(
        'UPDATE tasks SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3',
        [u.column_id, u.position, u.id]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post('/api/columns/reorder', requireAuth, async (req, res) => {
  const updates = req.body; // [{ id, position }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query('UPDATE columns SET position = $1 WHERE id = $2', [u.position, u.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.API_PORT || 4000;
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
