# Submarine Game Mode Integration Plan

## Overview

This plan outlines how to integrate the submarine game mode with the quiz system's functionality. We'll modify the existing submarine game files to work with the quiz system's routing structure and database connectivity.

## 1. Host Waiting Room (`app/gamemode/submarine/host/[id]/page.tsx`)

This page will be similar to `app/host/[id]/page.tsx` but with the submarine theme.

### Key Components:
- Game session creation and management
- Player list display
- QR code for joining
- Game PIN display
- Game settings (time limit, game end mode)
- Start game button

### Database Integration:
- Use Supabase to create a game session
- Store game settings in the session
- Track participants joining the session
- Update session status when starting the game

### UI Elements:
- Underwater theme with animated background
- Player avatars in submarine style
- Game PIN display with copy functionality
- Settings panel for game configuration

### Implementation Details:
- Adapt the existing `app/gamemode/submarine/host/room/[code]/page.tsx` to use the quiz system's routing
- Modify the session creation to use the quiz ID from the URL parameter
- Update the player list to use real-time Supabase subscriptions
- Implement the same game settings as the quiz system

## 2. Host Control Room (`app/gamemode/submarine/game/[id]/page.tsx`)

This page will be similar to `app/game/[id]/page.tsx` but with the submarine game mechanics.

### Key Components:
- Game progress tracking
- Player progress display
- Shark animation
- Timer display
- End game button

### Database Integration:
- Real-time updates of player progress
- Track game status and time
- Update session when game ends

### UI Elements:
- Animated underwater background
- Shark animation based on game progress
- Submarine representation of player progress
- Timer and level indicators

### Implementation Details:
- Adapt the existing `app/gamemode/submarine/host/game/[code]/page.tsx` to use the quiz system's routing
- Modify the progress tracking to use real-time Supabase data
- Implement the shark animation based on actual game progress
- Add the same end game functionality as the quiz system

## 3. Player Waiting Room (`app/gamemode/submarine/play/[id]/page.tsx`)

This page will be similar to `app/play/[id]/page.tsx` but with the submarine theme.

### Key Components:
- Player information display
- Waiting animation
- Game status monitoring
- Automatic transition to game

### Database Integration:
- Register player in the game session
- Monitor session status for game start
- Handle countdown and transition

### UI Elements:
- Underwater waiting animation
- Player avatar and nickname display
- Countdown animation when game starts

### Implementation Details:
- Adapt the existing `app/gamemode/submarine/player/waiting/[code]/page.tsx` to use the quiz system's routing
- Modify the player registration to use the same database structure
- Implement the same game status monitoring as the quiz system
- Keep the submarine-themed waiting animations

## 4. Player Active Game (`app/gamemode/submarine/play-active/[id]/page.tsx`)

This page will be similar to `app/play-active/[id]/page.tsx` but with the submarine game mechanics.

### Key Components:
- Question display
- Answer selection
- Hold button mechanic
- Image challenge
- Progress tracking

### Database Integration:
- Record player responses
- Track progress and score
- Handle special game mechanics (hold button, image challenge)

### UI Elements:
- Question and answer display with submarine theme
- Hold button with progress indicator
- Image challenge interface
- Progress and charge indicators

### Implementation Details:
- Adapt the existing `app/gamemode/submarine/player/game/[code]/page.tsx` to use the quiz system's routing
- Modify the question fetching to use the same database structure
- Implement the same answer recording as the quiz system
- Keep the submarine-specific game mechanics (hold button, image challenge)

## 5. Results Page (`app/gamemode/submarine/results/[id]/page.tsx`)

This page will be similar to `app/results/[id]/page.tsx` but with the submarine theme.

### Key Components:
- Player rankings
- Game statistics
- Special awards
- Play again and home buttons

### Database Integration:
- Fetch final scores and rankings
- Calculate special awards
- Handle game session completion

### UI Elements:
- Underwater celebration theme
- Player ranking with submarine styling
- Award displays
- Navigation buttons

### Implementation Details:
- Adapt the existing `app/gamemode/submarine/host/results/[code]/page.tsx` to use the quiz system's routing
- Modify the results fetching to use the same database structure
- Implement the same ranking calculation as the quiz system
- Keep the submarine-themed award displays

## Implementation Strategy

1. Start by creating the host waiting room, as it's the entry point for the game
2. Implement the database connectivity for session creation and player joining
3. Create the player waiting room to allow players to join
4. Implement the host control room for monitoring the game
5. Create the player active game with the submarine mechanics
6. Finally, implement the results page to show game outcomes

## Navigation Flow

1. Host creates game at `/gamemode/submarine/host/[id]`
2. Players join at `/gamemode/submarine/play/[id]`
3. When host starts game:
   - Host goes to `/gamemode/submarine/game/[id]`
   - Players go to `/gamemode/submarine/play-active/[id]`
4. When game ends:
   - Everyone goes to `/gamemode/submarine/results/[id]`

## Database Considerations

We'll use the existing database schema with the following tables:
- `game_sessions`: Store session info, PIN, status
- `game_participants`: Store player info and scores
- `game_responses`: Store player answers and points

No schema modifications are needed, as we can use the existing fields for the submarine game mechanics.

## Code Implementation Steps

For each page, we'll follow these steps:

1. Create the new file with the correct routing structure
2. Copy the relevant UI elements from the existing submarine game files
3. Integrate the database functionality from the quiz system
4. Update the navigation links to use the new routing structure
5. Test the page functionality

## Next Steps

We need to switch to Code mode to implement the actual code for each page. We'll start with the host waiting room and work through each page in the navigation flow.