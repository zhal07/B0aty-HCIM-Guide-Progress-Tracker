# B0aty HCIM Guide v3.0 Tracker

An interactive guide and checklist tracker for the B0aty HCIM guide for OSRS.

> **Disclaimer**: I created this app as an easier way to follow the guide and track progress. The guide content itself was created by B0aty and shared by contributors on the Old School RuneScape Wiki. 

## Features

- **Episode Navigation**: Browse through multiple episodes of the guide with easy navigation buttons
- **Task Tracking**: Mark individual tasks or entire banks as complete with persistent progress tracking
- **Progress Visualization**: Real-time progress bar showing overall completion percentage
- **Quick Actions** (in header and side bar—see below)
- **Local Storage**: Your progress is automatically saved to your browser

## How to use

1. Open `index.html` in your web browser
2. Select an episode using the episode buttons at the top of the header
3. Click on tasks to mark them as complete
4. Use the buttons to manage your progress:

**Header buttons**:
- **Resume**: Jump to your last incomplete task
- **Expand/Collapse**: Toggle all bank sections
- **Mark All**: Complete all tasks in the episode
- **Reset**: Clear all progress (with confirmation)

**Side bar**:
- **Jump to current task**: Scroll to and expand your next incomplete task
- **Scroll to top**: Return to the top of the page
- **Previous / Next episode**: Change episodes without scrolling to the header

## File structure

- `index.html` - Main page layout
- `app.js` - Application logic and UI interactions
- `styles.css` - Styling and layout
- `data.js` - Episode and task data
- `resources/` - Wiki file from the OSRS wiki, used as reference material
