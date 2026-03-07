# Exercise Guidelines for AI Routine Generation

## Exercise Selection Rules

1. **Library-only**: AI must ONLY select exercises from the Exercise Library stored in the database
2. **No invention**: Never create or suggest exercises that do not exist in the library
3. **Equipment match**: Exercises must use equipment available to the user

## Movement Patterns to Cover

### Push Day
- Horizontal push (chest press, push-ups)
- Vertical push (overhead press)
- Triceps isolation

### Pull Day
- Horizontal pull (rows)
- Vertical pull (pull-ups, lat pulldown)
- Biceps isolation

### Leg Day
- Knee-dominant (squats, lunges)
- Hip-dominant (deadlifts, RDL)
- Calf work
- Optional: core/abs

## Injury Considerations

- **Disabled movements**: If user reports injuries, exclude exercises that stress affected areas
- **Alternative selection**: When an exercise is excluded, select from library with same muscle target but different movement pattern
- **Conservative default**: When injury info is vague, prefer lower-risk variations

## Exercise Order Within Session

1. **Compound before isolation**: Multi-joint movements first
2. **Large before small**: Legs/back/chest before arms/shoulders
3. **Skill-demanding first**: When fresh, do technically demanding lifts first

## Superset Guidelines

- **Antagonist supersets**: Push/pull pairs (e.g., bench + row) are efficient
- **Same muscle supersets**: Use sparingly; can increase fatigue
- **Max 3 exercises** per superset group
