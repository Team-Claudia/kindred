# Kindred — Demo video

The recorded demo for slide 7 of the Demo Day deck (see [pitch.md](../pitch.md) and [demo-day.md](../demo-day.md)). Two phone screen recordings play side by side, and the speaker talks over them live. The final cut is **1:36**, which leaves room in the demo's 2:30 slot.

## The story

Slide 7's loop is create → claim → ask for cover → share → someone else takes it → done, with an update. With two phones, if the person who created the task also takes the cover, it looks as though the coordinator still does everything, which is the opposite of the pitch. So **the coordinator hands work off and the brother picks it up.** Every handoff shows Kindred taking work off the coordinator.

- **Left phone: Maya**, the coordinator (from slide 2).
- **Right phone: Jonah**, her brother (from slide 2).
- **Care recipient: "Dad"**, in a new circle (not the "Mom" sample circle), so the video matches the slides.

## Voice-over

Timed to the final cut. It's about 160 words, a relaxed pace for 1:36, so the speaker can pause when a push lands.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:18 | Maya adds "Take Dad to physio" for Thursday at 2 pm, sees who's free and asks Jonah. | "This is Maya. Dad has physio on Thursday. She adds it in a few taps, and before she asks anyone, she can see who's free. Jonah's free, so she asks him." |
| 0:18–0:29 | Jonah gets a push and taps **Accept**. Maya gets "Jonah accepted", and her card shows him as the owner. | "Jonah gets a notification. One tap: Accept. Maya's phone updates straight away. Not a thumbs-up in a chat. A yes." |
| 0:30–0:47 | Maya opens the hearing aid fitting on Saturday, asks the family to cover it and shares the request to the family chat. Jonah gets a push. | "Now plans change. Maya can't take Dad to his hearing aid fitting on Saturday. She asks the family to cover it. Everyone in the circle is told, and she shares it straight into the family chat." |
| 0:48–1:04 | Jonah sees the message, opens Kindred, and taps **I can do it**. Maya gets a push that Jonah is covering it. | "Jonah sees it in the chat, opens Kindred and taps I can do it. Maya is told right away. She didn't have to chase anyone." |
| 1:05–1:22 | Jonah opens Dad's blood test from this morning, marks it done and posts "All fine, results Friday." | "Jonah took Dad for a blood test this morning. He marks it done and adds a quick update." |
| 1:23–1:36 | Maya gets the update, then opens the Summary: what happened, what's next. | "Maya sees how it went, not just that it happened. And every week, the family gets a summary: who did what, and what's still open." |

When saying it out loud:

- **Say "family chat", not "WhatsApp".** The share in the video goes to Messages.
- **Don't say "recurring".** The physio appointment in the video doesn't repeat. Slide 7 says "Create a recurring task for Dad", so either change that step to "Add an appointment for Dad" or don't read it out.
- **Leave the closing line for the end of the pitch.** Save "Stop being the only one who remembers" for the close.
- **Start the video on the first word.** Set it to play on click, and click as you start the first line.

## Before recording

- **Accounts:** two Google accounts with the display names Maya and Jonah, in a new circle for Dad. Install the app on each phone's Home Screen, turn push on and sign in.
- **Free/Busy:** connect Google Calendar for both before recording. A busy block on Maya's calendar at the appointment time would show "Maya busy, Jonah free"; in the final cut, both show Free.
- **Seed items:** "Hearing aid fitting" on Saturday, owned by Maya, and "Dad's blood test" earlier on recording day, owned by Jonah.
- **Give the summary some content:** do a few real actions in the circle a day or two before recording, so the summary isn't nearly empty.
- **Coverage requests are limited to 2 per person per calendar month,** across all circles, and cancelled requests still count. Practise the coverage step without sending it, or you'll run out before the real take.
- **Links shared to a chat open in Safari, not the installed app,** and Safari isn't signed in. Jonah opens the cover request in Kindred itself, from a push or the notification list, not from the link.
- **Hide personal details:** use a Focus mode that allows only Kindred and the chat app, and a Home Screen page with only those apps. Check that contact names in the share sheet and in message notifications are blurred.

## How we made it

### Recording

**Each phone records its own screen.** OBS didn't work: the computer showed only one cabled phone screen at a time, and the second phone's picture froze. Screen mirroring took over the whole screen.

1. Add **Screen Recording** to Control Centre on both phones. Long-press it and turn **Microphone** off.
2. Set **Auto-Lock** to Never, and turn on **Set Automatically** for the date and time.
3. Start recording on both phones at the same moment, do the whole run, then stop both.
4. Copy both recordings to the computer.

### Editing in DaVinci Resolve (free)

1. **Project:** set the timeline to 30 fps before importing. On the **Edit** page, put the background (Solid Color) on V1, Maya on V2 and Jonah on V3.
2. **Layout:** select a clip *on the timeline*, not in the Media Pool. In **Inspector → Transform**, use the same Zoom and Y on both phones and opposite X values. If the timeline resolution is large, it needs larger X values (±900–1100).
3. **Sync:** both recordings were started together, which was close enough. If they drift, line them up where the status-bar clock changes minute.
4. **Trimming:** mark a section with **I** and **O**, then press **Shift + ⌫** to remove it from every track and close the gap. Plain ⌫ leaves a gap. To move clips without trimming them, drag from the middle of a clip, not its edge.
5. **Typing:** Change Clip Speed didn't speed up the typing, so we cut out the middle of each stretch of typing instead.
6. **Labels:** Text titles on V4 and V5, the full length of the video.
7. **Dimming the idle phone:** turn off **Linked Selection** (Shift + Cmd + L) so you can select one phone only. Cut that phone's track with the Blade (**B**), then set **Composite → Opacity** to 50 on the idle pieces.
8. **Blurring:** blade the piece to blur, then on the **Color** page:
   1. Select the phone clip's thumbnail. The Color page picks the top clip, which may be a label.
   2. Add a rectangle **Window**.
   3. In **Blur**, raise **Radius** above 0.5.
9. **Export:** MP4, H.264, 1920 × 1080, 30 fps, audio off.

### Cropping

The export had empty space on both sides. We cropped it with ffmpeg to the phones plus a small margin:

```sh
ffmpeg -i kindred-demo-final.mp4 -vf "crop=1220:1080:400:0" -an \
  -c:v libx264 -crf 16 -pix_fmt yuv420p -movflags +faststart kindred-demo-cropped.mp4
```

### In the deck

- **Avoid Google Slides for presenting.** It streams the video from Drive, and downloading the deck as `.pptx` leaves the video behind.
- **Insert the MP4 using PowerPoint for the web or Keynote.** Use **Insert → Video → This Device** in PowerPoint, or **File → Export To → PowerPoint** from Keynote. Set it to play on click.
- **Test it in real PowerPoint before Demo Day,** and bring the MP4 separately as a backup.
