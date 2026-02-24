const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/bushu-data.json', 'utf8'));

// Basic validation
console.log('Total entries:', data.length);

const gradeCounts = {};
const diffCounts = {};
const errors = [];

data.forEach((entry, i) => {
  // Check required fields
  if (!entry.answer) errors.push(`Entry ${i}: missing answer`);
  if (!entry.parts || !Array.isArray(entry.parts)) errors.push(`Entry ${i}: missing/invalid parts`);
  else if (entry.parts.length !== 2) errors.push(`Entry ${i} (${entry.answer}): parts.length=${entry.parts.length}, expected 2`);
  if (!entry.hint) errors.push(`Entry ${i} (${entry.answer}): missing hint`);
  if (!entry.grade) errors.push(`Entry ${i} (${entry.answer}): missing grade`);
  if (!entry.difficulty) errors.push(`Entry ${i} (${entry.answer}): missing difficulty`);

  // Grade validation - only 1-6 allowed
  if (entry.grade < 1 || entry.grade > 6) {
    errors.push(`Entry ${i} (${entry.answer}): grade=${entry.grade}, expected 1-6`);
  }

  // Difficulty validation - only 1-3
  if (entry.difficulty < 1 || entry.difficulty > 3) {
    errors.push(`Entry ${i} (${entry.answer}): difficulty=${entry.difficulty}, expected 1-3`);
  }

  // Count by grade
  gradeCounts[entry.grade] = (gradeCounts[entry.grade] || 0) + 1;
  diffCounts[entry.difficulty] = (diffCounts[entry.difficulty] || 0) + 1;
});

// Check for duplicates
const answers = data.map(d => d.answer);
const dupes = answers.filter((a, i) => answers.indexOf(a) !== i);
if (dupes.length > 0) {
  errors.push(`Duplicate answers: ${[...new Set(dupes)].join(', ')}`);
}

console.log('\nGrade counts:');
Object.keys(gradeCounts).sort().forEach(g => {
  console.log(`  Grade ${g}: ${gradeCounts[g]}`);
});

console.log('\nDifficulty counts:');
Object.keys(diffCounts).sort().forEach(d => {
  console.log(`  Difficulty ${d}: ${diffCounts[d]}`);
});

if (errors.length > 0) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.forEach(e => console.log('  ' + e));
  process.exit(1);
} else {
  console.log('\nAll entries valid!');
}

// Check minimum per grade for puzzle (need at least 5 for a round)
console.log('\nPer-grade difficulty breakdown:');
for (let g = 1; g <= 6; g++) {
  const gradeData = data.filter(d => d.grade === g);
  for (let diff = 1; diff <= 3; diff++) {
    const count = gradeData.filter(d => d.difficulty <= diff).length;
    const ok = count >= 5 ? 'OK' : 'TOO FEW';
    console.log(`  Grade ${g}, diff<=${diff}: ${count} entries [${ok}]`);
  }
}
