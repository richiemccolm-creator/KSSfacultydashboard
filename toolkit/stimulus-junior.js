/*
 * Stimulus Generator: simple mode for S1–S2 (age 11–12).
 * Pupils choose a story type and their group size, and get a story laid out on the
 * plot mountain: exposition, conflict, rising action, climax, falling action, resolution.
 * They choose their climax and ending, then tick off each stage once they have planned it.
 */
(function (root) {
  "use strict";

  var TYPES = [
    { id: "funny", label: "Funny", emoji: "😂", blurb: "Things go hilariously wrong" },
    { id: "spooky", label: "Spooky", emoji: "👻", blurb: "Creepy, but not too scary" },
    { id: "mystery", label: "Mystery", emoji: "🔍", blurb: "Something is missing. Who did it?" },
    { id: "adventure", label: "Adventure", emoji: "🧭", blurb: "A challenge or a race against time" },
    { id: "real", label: "Real life", emoji: "🏫", blurb: "Friends, family and big decisions" },
    { id: "fantasy", label: "Fantasy & sci-fi", emoji: "🚀", blurb: "Magic, robots, aliens, time travel" }
  ];

  var CASTS = [2, 3, 4, 5, 6];

  var NARRATOR = { role: "The narrator", want: "to help the audience follow the story" };

  // The fixed parts of each stage. tension is out of 5, matching the height on the plot mountain.
  var STAGES = [
    {
      id: "exposition", label: "Exposition", plain: "Set the scene", part: "Beginning", tension: 1,
      think: ["Where are we? How will the audience know?", "Who are the characters? How can we tell who is who?", "What is normal life like before the problem?"],
      tip: "Start with a freeze frame so the audience can see everyone before the action begins."
    },
    {
      id: "conflict", label: "Conflict", plain: "The problem starts", part: "Beginning", tension: 2,
      think: ["What goes wrong?", "Who is most upset about it, and how do they show it?"],
      tip: "Make the moment the problem starts really clear: a sudden sound, a gasp, or everyone stopping still."
    },
    {
      id: "rising", label: "Rising action", plain: "Things get worse", part: "Middle", tension: 4,
      think: ["Each moment should make things worse than the last. What order do they go in?", "How will you show the tension building?"],
      tip: "Climb the mountain: get a bit faster, louder and closer together with each moment."
    },
    {
      id: "climax", label: "Climax", plain: "The most tense moment", part: "Middle", tension: 5,
      think: ["Which climax will you use?", "What does every character do at this exact moment?"],
      tip: "At the very top of the mountain, try slow motion or a freeze frame."
    },
    {
      id: "falling", label: "Falling action", plain: "Things calm down", part: "End", tension: 3,
      think: ["What happens straight after the climax?", "How do the characters feel now?"],
      tip: "Slow your pace and lower your voices. The audience can breathe again."
    },
    {
      id: "resolution", label: "Resolution", plain: "How it ends", part: "End", tension: 1,
      think: ["Which ending will you use?", "What has changed for the characters since the start?"],
      tip: "Finish on a final freeze frame (a tableau) so the audience knows the story is over."
    }
  ];

  var OWN_IDEA = "own";

  function r(role, want) { return { role: role, want: want }; }
  function c(text, falling) { return { text: text, falling: falling }; }

  function story(id, type, title, where, who, exposition, conflict, rising, climaxes, endings) {
    return {
      id: id, type: type, title: title, where: where, who: who,
      exposition: exposition, conflict: conflict, rising: rising, climaxes: climaxes, endings: endings
    };
  }

  var STORIES = [
    // FUNNY
    story("funny-1", "funny", "The Talent Show Disaster", "The school hall on talent show night",
      [r("The nervous performer", "to get through their act without messing up"), r("The over-confident host", "to be the star of the show"), r("The best friend backstage", "to help, even when it goes wrong"), r("The teacher in charge", "for the show to finish on time"), r("The loudest person in the audience", "to see something exciting")],
      "It is the school talent show. The hall is packed and everyone is excited. The nervous performer is waiting backstage.",
      "The performer is on next, but their music will not play!",
      ["The host tells jokes to fill the time. Nobody laughs.", "The best friend tries to fix it and switches off all the lights.", "The teacher says: \"One minute, or you are cut from the show.\""],
      [c("The performer walks on with no music and has to make the whole act up on the spot.", "Slowly, the audience starts clapping along."),
       c("Someone else's music plays by mistake. It is a really silly song.", "The performer decides to dance to it anyway.")],
      ["They win the prize for Most Creative Act.", "The music finally works, just as the show ends. Everyone laughs."]),
    story("funny-2", "funny", "The Great Hamster Escape", "A classroom, five minutes before an important visitor arrives",
      [r("The class pet monitor", "to catch the hamster before anyone notices"), r("The important visitor", "to give a serious speech"), r("The teacher", "to look calm and in control"), r("The class clown", "to make everyone laugh"), r("The quiet pupil", "to help, because they know a lot about animals")],
      "It is a normal morning. The class are tidying up because an important visitor is coming. The hamster, Mr Nibbles, is in his cage.",
      "Mr Nibbles has escaped, and the visitor will be here in five minutes!",
      ["They spot him under the teacher's desk, but he runs away.", "The visitor arrives early.", "Someone shouts: \"He's in the visitor's bag!\""],
      [c("Mr Nibbles pops out of the visitor's bag in the middle of their speech.", "Everyone freezes. Then the visitor starts to laugh."),
       c("The pet monitor dives to catch him and lands head first in the bin.", "They are holding the hamster, but they are covered in paper.")],
      ["The visitor says it was the best school visit ever.", "The quiet pupil puts Mr Nibbles back and becomes the new pet monitor."]),
    story("funny-3", "funny", "The Wrong Birthday Cake", "A kitchen at home, just before a surprise party",
      [r("The party planner", "to make this the best birthday ever"), r("The helper", "to fix things fast"), r("The little brother or sister", "to eat as much cake as possible"), r("The birthday person", "to find out what everyone is hiding"), r("Gerald, a stranger", "to find his missing cake")],
      "The kitchen is full of balloons. The party planner has organised a surprise party and the cake has just been delivered.",
      "They open the box. The cake says \"Happy Retirement, Gerald\"!",
      ["They try to scrape the writing off. It turns into a big brown smudge.", "The little brother or sister eats a huge piece of it.", "They hear the front door. The birthday person is home early!"],
      [c("The birthday person walks in while they are writing on the cake with ketchup.", "There is a long silence. Then the birthday person bursts out laughing."),
       c("Gerald knocks on the door, looking for his cake.", "They all agree to swap cakes.")],
      ["Everyone agrees it was the best birthday ever, because of the story.", "Gerald stays for the party and does the best dance of the night."]),
    story("funny-4", "funny", "The Swapped Lunchboxes", "The school canteen at lunchtime",
      [r("The fussy eater", "to eat something normal"), r("The food lover", "to try everything"), r("The dinner supervisor", "to keep the canteen in order"), r("The friend who loves a dare", "to see something funny"), r("The real owner of the lunchbox", "to get their lunch back")],
      "It is lunchtime in a noisy canteen. Everyone grabs their lunchbox from the trolley.",
      "Two pupils have grabbed the wrong lunchboxes, and one is full of really strange food!",
      ["The friend dares the fussy eater to try the strange food.", "The real owner is searching the whole canteen.", "The supervisor says nobody leaves until the lunchboxes are found."],
      [c("The real owner catches the fussy eater in the middle of a big bite.", "The owner admits they hate that food too."),
       c("Both lunchboxes fall and the food goes everywhere.", "Everyone has to share what is left.")],
      ["They start swapping lunches every Friday.", "They start a \"try something new\" club."]),
    story("funny-5", "funny", "The Homework Excuse", "A classroom, first thing on Monday",
      [r("The pupil without their homework", "to stay out of trouble"), r("The teacher", "to collect every piece of homework"), r("The best friend", "to help, but they keep making it worse"), r("The headteacher", "to find good news for the newsletter"), r("A parent", "to drop off a forgotten PE bag")],
      "It is Monday morning. The teacher is collecting homework. One pupil has forgotten to do theirs.",
      "The pupil makes up a wild excuse, and the teacher believes it!",
      ["The teacher asks for more details, so the story gets bigger.", "The best friend tries to help and adds something even sillier.", "The headteacher hears about it and wants to put it in the newsletter."],
      [c("A parent walks in and tells everyone the real story.", "Everyone turns to stare at the pupil."),
       c("The pupil cannot keep it up and confesses in front of the whole class.", "There is silence, then everyone starts to giggle.")],
      ["They have to do the homework and write the excuse as a story. It gets top marks.", "The teacher says they knew it was made up all along."]),

    // SPOOKY
    story("spooky-1", "spooky", "The Sleepover Noise", "A living room during a sleepover",
      [r("The host", "for the sleepover to be fun, not scary"), r("The brave one", "to prove they are not scared"), r("The scared one", "to go home"), r("The joker", "to scare everyone"), r("The older brother or sister", "to get some sleep")],
      "It is a sleepover. Sleeping bags are on the floor and everyone is telling stories.",
      "At midnight, a strange tapping noise starts upstairs.",
      ["The lights flicker.", "The torch runs out of battery.", "The living room door creaks open on its own."],
      [c("A shadow appears in the doorway and everyone screams. It is the older brother or sister with a pillow.", "Everyone laughs with relief."),
       c("The scared one bravely goes upstairs alone to check.", "They find an open window and a branch tapping on the glass.")],
      ["They plan a funny revenge prank for the morning.", "The scared one is the hero of the sleepover."]),
    story("spooky-2", "spooky", "Locked In After School", "An empty school after everyone has gone home",
      [r("The pupil who forgot their bag", "to get their bag and go home"), r("Their friend", "to stay close and not be left alone"), r("The caretaker", "to lock up for the night"), r("The ghost of a pupil from 1950", "to find something they lost"), r("The teacher working late", "to finish their marking in peace")],
      "School has finished. The corridors are empty and quiet. Two friends go back to get a forgotten bag.",
      "The classroom door slams and locks behind them!",
      ["The corridor lights switch off one by one.", "The piano in the music room starts playing on its own.", "Words appear on the whiteboard: \"Help me find it.\""],
      [c("They find an old medal in a cupboard, with a photo of a pupil from 1950.", "The piano stops. The door clicks open."),
       c("The caretaker appears in the doorway with a torch and gives everyone a fright.", "He explains that the old school is just a bit creaky.")],
      ["They give the medal to the school museum and hear a quiet \"thank you\".", "They walk home together, but the words on the whiteboard have changed..."]),
    story("spooky-3", "spooky", "The Door Marked Do Not Enter", "An old castle on a school trip",
      [r("The pupil who wanders off", "to explore"), r("The pupil who does not believe in ghosts", "to prove ghosts are not real"), r("The pupil who does believe", "to see a real ghost"), r("The tour guide", "to keep the tour on time"), r("The teacher", "to make sure nobody is missing")],
      "The class is on a trip to an old castle. The tour guide is telling stories about its history.",
      "One pupil wanders off and finds a door marked DO NOT ENTER.",
      ["They go in. A cold wind blows through the room.", "The eyes in an old painting seem to follow them.", "The door shuts behind them, and they hear footsteps."],
      [c("A figure in old clothes appears. It is an actor from the castle's ghost tour.", "Everyone laughs, but their hearts are still racing."),
       c("They find an old key that the castle has been missing for 100 years.", "The tour guide cannot believe it.")],
      ["The whole class gets a free ghost tour.", "Their names go on a plaque in the castle."]),
    story("spooky-4", "spooky", "The Mirror in the Attic", "Granny's dusty attic",
      [r("The grandchild", "to find out what the mirror is showing them"), r("Their cousin", "to go back downstairs"), r("Granny", "to keep an old secret"), r("The reflection", "to show them something hidden"), r("A parent calling from downstairs", "to get everyone down for tea")],
      "The family are visiting Granny. The children are sent up to the attic to find some old photos.",
      "An old mirror shows the attic, but everything in it looks different.",
      ["Their reflection waves a second too late.", "Writing appears in the dust on the glass.", "The reflection points to a box in the corner."],
      [c("They open the box. It is full of letters Granny wrote when she was their age.", "The mirror goes back to normal."),
       c("Granny comes up the stairs. She says the mirror did the same thing to her.", "She sits down to tell them the story.")],
      ["They read the letters together with Granny.", "They promise to keep the mirror's secret."]),
    story("spooky-5", "spooky", "Footsteps Round the Campfire", "A campsite in the woods at night",
      [r("The storyteller", "to tell the scariest story ever"), r("The scared camper", "to get in their tent"), r("The camp leader", "to keep everyone safe"), r("The joker", "to make everyone jump"), r("A lost hiker", "to find their way home")],
      "The group are sitting round a campfire, toasting marshmallows and telling ghost stories.",
      "In the middle of the story, they hear real footsteps in the woods.",
      ["The footsteps stop whenever they stop talking.", "A torch light moves between the trees.", "The camp leader goes to check, and does not come back."],
      [c("The leader comes back with a lost hiker, who is just as scared as they are.", "They make room for the hiker by the fire."),
       c("Everyone hides in one tent. A voice outside says: \"Who's got the marshmallows?\"", "It is the camp leader, laughing.")],
      ["The hiker gets home safely and sends them a thank-you letter.", "The leader admits it was a test of how well they work as a team."]),

    // MYSTERY
    story("mystery-1", "mystery", "The Missing Trophy", "The school foyer, on the morning of the big match",
      [r("The pupil detective", "to solve the case"), r("The team captain", "to win the match"), r("The new pupil", "to fit in"), r("The caretaker", "to keep the school clean and tidy"), r("The headteacher", "to find the trophy before the visitors arrive")],
      "It is the morning of the big football match. The trophy sits in the glass cabinet in the foyer.",
      "The trophy has vanished!",
      ["There is a trail of glitter leading away from the cabinet.", "Someone says they saw the new pupil near the cabinet.", "The captain's bag has glitter on it."],
      [c("The detective gathers everyone and reveals the caretaker took the trophy to polish it.", "Everyone says sorry to the new pupil."),
       c("The captain confesses they hid the trophy for good luck.", "The team has to decide what to do.")],
      ["The new pupil joins the team.", "They win the match and the trophy goes back in the cabinet."]),
    story("mystery-2", "mystery", "The Secret Notes", "The school library",
      [r("The pupil who finds the note", "to find out who wrote it"), r("Their best friend", "to help solve it"), r("The librarian", "to keep the library quiet"), r("The shy pupil", "to make a friend, without being noticed"), r("The class gossip", "to tell everyone what is going on")],
      "It is a quiet afternoon in the library. A pupil opens a library book.",
      "Inside is a note: \"Meet me at the clock at 3 o'clock.\" Who wrote it?",
      ["More notes start to appear in other books.", "The gossip finds out and tells the whole class.", "At 3 o'clock, nobody is at the clock. There is one more note: \"Too many people.\""],
      [c("The shy pupil steps out. They wrote the notes because they wanted to make a friend.", "The gossip feels bad for telling everyone."),
       c("The librarian reveals the notes are part of a secret reading treasure hunt.", "Everyone wants to join in.")],
      ["The pupil and the shy note-writer become good friends.", "The whole class does the treasure hunt together."]),
    story("mystery-3", "mystery", "The Vanishing Painting", "The school art exhibition",
      [r("The artist", "for everyone to see their painting"), r("The rival artist", "to win best in show"), r("The art teacher", "for the exhibition to go perfectly"), r("The cleaner", "to keep everything safe"), r("The detective", "to find out what happened")],
      "It is the night of the school art exhibition. Parents will be arriving soon.",
      "The best painting in the exhibition has disappeared!",
      ["There is a smudge of wet paint on the floor.", "Someone saw the cleaner pushing a trolley out of the room.", "The rival artist looks very pleased about something."],
      [c("They find the painting in the cleaner's cupboard. The cleaner moved it away from a leak in the roof.", "Everyone realises they guessed wrong."),
       c("The rival artist confesses they hid it because they were jealous.", "The artist is upset, but listens to why.")],
      ["The painting is hung in the best spot in the exhibition.", "The two artists make a painting together."]),
    story("mystery-4", "mystery", "The Lost Dog", "The local park",
      [r("The dog's owner, an older neighbour", "to get their dog back"), r("The first young detective", "to solve the case"), r("The second young detective", "to be the one who finds the dog"), r("The ice cream seller", "to sell ice cream"), r("The park keeper", "to keep the park safe")],
      "It is a sunny Saturday in the park. Posters with a picture of a dog are stuck to every tree.",
      "The neighbour's dog, Biscuit, has been missing all morning.",
      ["They hear barking near the pond.", "The ice cream seller says they saw something strange.", "They find Biscuit's collar in the bushes."],
      [c("They find Biscuit stuck on the little island in the middle of the pond.", "The park keeper rows out in a boat to rescue him."),
       c("They find Biscuit behind the ice cream van, with three puppies!", "The neighbour cannot believe it.")],
      ["The neighbour gives them a reward: a big bag of sweets.", "The puppies need homes, and one goes home with a detective."]),
    story("mystery-5", "mystery", "The Hidden Room", "The drama studio, before a school show",
      [r("The first explorer", "to find out what is behind the door"), r("The second explorer", "to get back before they are caught"), r("The drama teacher", "to start the show on time"), r("The caretaker", "to keep an old secret"), r("The stage manager", "to get everyone in place")],
      "The class is tidying the drama studio before the school show.",
      "Behind a curtain, they find a hidden door. Inside is a dusty box with a lock and a riddle.",
      ["They solve the riddle. Inside the box is a map.", "The map leads to the stage.", "The show starts in ten minutes!"],
      [c("Under the stage they find a time capsule left by pupils 30 years ago.", "The drama teacher has to hold the curtain while they climb out."),
       c("The caretaker catches them, then smiles. He left the box there when he was a pupil.", "He tells them the story of his school show.")],
      ["They open the time capsule in assembly.", "They make their own time capsule for pupils in the future."]),

    // ADVENTURE
    story("adventure-1", "adventure", "Lost on the Hill", "A hill walk on a school trip",
      [r("The leader", "to get everyone back safely"), r("The map reader", "to find the right path"), r("The tired one", "to stop and rest"), r("The worrier", "to call for help"), r("The brave one", "to keep going")],
      "The class is on a hill walk. It is a bright day and everyone is chatting.",
      "Thick fog comes down, and the group is separated from the teacher.",
      ["Their phones have no signal.", "They find the bridge over the stream is broken.", "It starts to get dark."],
      [c("The tired one slips and hurts their ankle. The group has to carry them.", "They see torch lights coming up the hill."),
       c("The group argues about which way to go, and splits up.", "They realise they have to stick together, and find each other again.")],
      ["The rescue team finds them, and the teacher gives everyone a hug.", "They find the path on their own and walk into camp as heroes."]),
    story("adventure-2", "adventure", "The Message in a Bottle", "A beach, as the tide comes in",
      [r("The finder", "to follow the map"), r("The careful one", "to get home before the tide comes in"), r("The fast runner", "to get there first"), r("The leader of a rival group", "to find the treasure before them"), r("The lifeguard", "to keep everyone safe")],
      "It is a windy day at the beach. The group are looking in rock pools.",
      "A bottle washes up with an old map inside. But the tide is coming in.",
      ["The first clue is hidden in the rock pools.", "A rival group has found a copy of the map too.", "The tide starts cutting off the path back."],
      [c("They dig and find a box. Inside is a letter written by a child 50 years ago.", "They read it out loud, sitting on the sand."),
       c("They have to choose: dig for the treasure, or help the rival group who are stuck by the tide.", "They choose to help.")],
      ["They find the person who wrote the letter, who is now a grandparent.", "They share the treasure with the rival group."]),
    story("adventure-3", "adventure", "The Race to the Show", "The streets between home and school",
      [r("The pupil who overslept", "to get to school in time"), r("Their friend", "to help them get there"), r("A helpful parent", "to give them a lift"), r("The drama teacher", "to start the show on time"), r("A bus driver", "to keep to the timetable")],
      "Today is the day of the big class performance. Two friends are getting ready at home.",
      "They miss the bus, and the show starts in twenty minutes!",
      ["They try to run, but the road is closed.", "A parent gives them a lift, but the car breaks down.", "They borrow bikes, and one gets a flat tyre."],
      [c("They burst into the hall just as the curtain opens.", "They walk on stage, out of breath, still wearing their coats."),
       c("They arrive and find out the show has been moved to tomorrow.", "They collapse on the floor, laughing.")],
      ["They perform anyway, and the audience loves it.", "They use the extra day to practise one more time."]),
    story("adventure-4", "adventure", "Stranded", "A small island after a boat trip goes wrong",
      [r("The captain", "to keep the group calm"), r("The builder", "to make a shelter"), r("The food finder", "to find something to eat"), r("The lookout", "to spot a rescue boat"), r("A person who lives on the island", "to find out who these visitors are")],
      "The group are on a boat trip, enjoying the sunshine and the waves.",
      "The engine stops. The boat drifts onto a small island.",
      ["They build a shelter out of branches.", "Their food is running out.", "Dark clouds show a storm is coming."],
      [c("They make a giant SOS sign out of stones, just as a helicopter flies over.", "The helicopter turns around and comes back for them."),
       c("They find out a family lives on the island, and the family takes them in from the storm.", "They sit round the family's fire, warm and dry.")],
      ["They get home and remember everything they learned about teamwork.", "They visit the island family every summer."]),
    story("adventure-5", "adventure", "Escape the Maze", "A giant maze at the summer fair",
      [r("The leader", "to get everyone out"), r("The friend who lost their glasses", "to not slow everyone down"), r("The joker", "to make it fun"), r("The worrier", "to get out before it closes"), r("The maze keeper", "to lock up on time")],
      "It is the summer fair. The group goes into the giant maze for a laugh.",
      "The maze closes in twenty minutes, and one friend has lost their glasses.",
      ["Every path leads to a dead end.", "The lights in the maze switch off.", "They hear the gates being locked."],
      [c("They climb on each other's shoulders to see over the hedge and spot the exit.", "They run for it."),
       c("The friend without glasses remembers the way out by listening to the fair music.", "Everyone follows the sound.")],
      ["They get out just as the gate closes.", "The friend who lost their glasses gets a big thank you."]),

    // REAL LIFE
    story("real-1", "real", "The New Pupil", "A school, on a new pupil's first day",
      [r("The new pupil", "to make one friend"), r("Their buddy", "to get on with their own day"), r("The leader of the popular group", "to stay popular"), r("The teacher", "for the new pupil to settle in"), r("The kind dinner lady", "to make sure nobody eats alone")],
      "It is the middle of the year. A new pupil arrives and is given a buddy to show them around.",
      "Nobody wants to sit with the new pupil.",
      ["They are left out at lunch.", "Some pupils copy the way they talk, as a joke.", "They eat lunch alone in the library."],
      [c("The buddy stands up for them in front of everyone.", "The room goes quiet."),
       c("In a drama lesson, the new pupil shows an amazing talent and everyone sees them differently.", "People start asking them questions.")],
      ["The buddy and the new pupil become real friends.", "The leader of the popular group says sorry."]),
    story("real-2", "real", "The Broken Window", "A street outside a row of houses",
      [r("The pupil who kicked the ball", "to not get in trouble"), r("Their best friend", "to stick together"), r("The friend who wants to run", "to get away fast"), r("The neighbour", "to find out who did it"), r("A parent", "to hear the truth")],
      "A group of friends are playing football in the street after school.",
      "The ball smashes the neighbour's window. Who will own up?",
      ["The neighbour comes out, very angry.", "One friend says: \"Run!\"", "At tea, a parent asks if they know anything about it."],
      [c("The pupil who kicked the ball knocks on the neighbour's door and owns up.", "The neighbour is surprised and calms down."),
       c("Another friend gets blamed, which is not fair.", "The pupil has to decide whether to speak up.")],
      ["They do jobs to help pay for the window, and the neighbour becomes a friend.", "The truth comes out, and the friendship is fixed."]),
    story("real-3", "real", "The Group Project", "A classroom and a bedroom, the night before a deadline",
      [r("The pupil doing all the work", "for everyone to help"), r("The friend who keeps messing about", "to have fun"), r("The quiet one", "to help but does not know how"), r("The teacher", "for everyone to do their share"), r("A parent", "for everyone to get some sleep")],
      "The class has been given a group project. It is due tomorrow.",
      "One person is doing all the work, and the others are not helping.",
      ["The others keep messing about.", "The hard worker gets more and more upset.", "The laptop crashes and the work is lost."],
      [c("The hard worker explodes and tells the group exactly how they feel.", "Everyone goes quiet and looks at the floor."),
       c("The group stays up on a video call and finishes it together.", "They are tired, but proud.")],
      ["They present it together and share the credit.", "They get a fair mark and learn to share out the jobs."]),
    story("real-4", "real", "Moving Away", "A bus stop near school",
      [r("The friend who is moving", "to say goodbye without crying"), r("Their best friend", "to know why they were not told"), r("Another friend", "to keep the group together"), r("The person who spreads the news", "to be the first to know things"), r("A parent", "to help their child say goodbye")],
      "It is an ordinary week. The friends meet at the bus stop every morning.",
      "One friend is moving to another city on Friday, and has not told the others.",
      ["Rumours start going round.", "The friend starts acting strangely.", "Their best friend finds out from someone else."],
      [c("There is a big argument at the bus stop: \"Why didn't you tell me?\"", "They both sit down on the bench, not speaking."),
       c("The friend finds out the others have planned a surprise goodbye party.", "They cannot stop smiling.")],
      ["They promise to video call every week.", "They make a memory box to keep."]),
    story("real-5", "real", "The Dare", "A school corridor at break time",
      [r("The pupil who is dared", "to fit in with the group"), r("The leader of the group", "to show they are in charge"), r("The friend who says no", "to keep everyone out of trouble"), r("The teacher on duty", "to keep the corridors safe"), r("A younger pupil watching", "to look up to the older pupils")],
      "It is break time. A group of friends are hanging around the corridor.",
      "The group dares one pupil to sneak into the staffroom.",
      ["Everyone starts chanting their name.", "They nearly get caught by a teacher.", "Inside, they knock a phone onto the floor and the screen cracks."],
      [c("At the staffroom door, they turn round and say no.", "The chanting stops."),
       c("They get caught, and have to decide whether to name the others.", "Everyone waits to hear what they will say.")],
      ["The rest of the group respects them more for saying no.", "They all own up together."]),

    // FANTASY & SCI-FI
    story("fantasy-1", "fantasy", "The Time Travel Lunchbox", "A classroom today, and a Victorian classroom in 1850",
      [r("The pupil who opens the lunchbox", "to get back home"), r("Their friend", "to explore the past"), r("A strict Victorian teacher", "for everyone to sit up straight and be silent"), r("A Victorian child", "to see the future"), r("A modern teacher", "to find out where everyone has gone")],
      "It is lunchtime. A pupil finds an old lunchbox in lost property.",
      "When they open it, they are sent back in time to 1850!",
      ["They land in a Victorian classroom with a very strict teacher.", "Their friend gets left behind in the past.", "The lunchbox's power is running out."],
      [c("They have to make the strict Victorian teacher laugh to get the lunchbox back.", "The teacher finally smiles, and hands the lunchbox over."),
       c("They swap places with a Victorian child by mistake.", "They have to find each other before the power runs out.")],
      ["They get home, and are very happy to be in a modern school.", "The Victorian child comes to visit the present day."]),
    story("fantasy-2", "fantasy", "The Robot Classmate", "A classroom in the near future",
      [r("The robot pupil", "to make a friend"), r("The pupil sat next to it", "to be left alone"), r("The class clown", "to make fun of the robot"), r("The teacher", "for the robot to fit in"), r("The scientist who built it", "to take the robot back to the lab")],
      "A new pupil joins the class. It is a robot.",
      "The robot can learn anything except how to make friends, and it will be taken away tomorrow.",
      ["The robot copies everyone, but gets it all wrong.", "Everyone laughs at the robot.", "The scientist arrives to take it away."],
      [c("The fire alarm goes off, and the robot saves the class.", "Everyone looks at the robot differently."),
       c("The class teaches the robot to tell a joke, and it finally laughs.", "The whole class laughs with it.")],
      ["The robot gets to stay at the school.", "The robot leaves, but sends the class a message every week."]),
    story("fantasy-3", "fantasy", "The Wishing Well", "An old well in the woods",
      [r("The wisher", "to have everything they want"), r("The careful friend", "to stop them wishing"), r("The spirit of the well", "to teach them a lesson"), r("A person who really needs a wish", "to make their family's life better"), r("A teacher", "to find out where everyone has gone")],
      "A group of friends are exploring the woods and find an old stone well.",
      "The well grants three wishes, but every wish has a catch.",
      ["First wish: no more homework. But all the teachers vanish too.", "Second wish: to be famous. But now they cannot go anywhere.", "There is only one wish left."],
      [c("They use the last wish to undo everything.", "Everything goes back to normal."),
       c("They give the last wish to someone who needs it more.", "The well starts to glow.")],
      ["They learn to be careful what they wish for.", "The person's wish comes true, and they all become friends."]),
    story("fantasy-4", "fantasy", "The Alien Exchange Pupil", "A school, during exchange week",
      [r("The alien", "to learn how to be a human pupil"), r("The host pupil", "to keep the alien a secret"), r("The best friend", "to help hide the alien"), r("The headteacher", "to meet the new exchange pupil"), r("The nosy pupil", "to find out what is going on")],
      "It is exchange week. A pupil is looking after an exchange pupil from very far away.",
      "The exchange pupil is an alien, and the headteacher must not find out!",
      ["The alien eats the stapler.", "The alien turns invisible in PE.", "The headteacher calls them all to a meeting."],
      [c("The alien's disguise falls off in front of the whole school in assembly.", "Everyone stares. Then someone starts clapping."),
       c("The alien saves the headteacher when a ladder falls.", "The headteacher sees who the alien really is.")],
      ["The school welcomes the alien.", "The alien goes home with a school jumper as a gift."]),
    story("fantasy-5", "fantasy", "The Magic Paintbrush", "The art room",
      [r("The pupil who finds the brush", "to paint whatever they want"), r("Their friend", "to keep the brush a secret"), r("The art teacher", "to keep the art room tidy"), r("The dragon", "to go home"), r("The pupil who wants the brush", "to take it for themselves")],
      "It is an art lesson. A pupil finds an old paintbrush in the back of a drawer.",
      "Whatever they paint with it comes to life!",
      ["They paint a pizza, and it is real.", "They paint a dog, and it runs around the room.", "Someone grabs the brush and paints a dragon by mistake."],
      [c("The dragon gets loose in school. They have to paint a giant cage before it is too late.", "The dragon sits in the cage, looking sorry."),
       c("They paint a door to send the dragon home.", "The dragon flies through the door and waves goodbye.")],
      ["The brush is locked away where nobody can find it.", "The dragon comes back to visit once a year."])
  ];

  function findType(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return null;
  }

  function pick(arr, rng) {
    return arr[Math.floor((rng || Math.random)() * arr.length)];
  }

  function stageDef(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return null;
  }

  function generate(choices, opts) {
    choices = choices || {};
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var avoid = opts.avoid || [];
    var lockedType = opts.locks && opts.locks.type;
    var type = findType(lockedType) || findType(choices.type) || pick(TYPES, rng);
    var cast = parseInt(choices.cast, 10);
    if (CASTS.indexOf(cast) < 0) cast = 4;

    var pool = STORIES.filter(function (s) { return s.type === type.id; });
    var fresh = pool.filter(function (s) { return avoid.indexOf(s.id) < 0; });
    var s = pick(fresh.length ? fresh : pool, rng);

    var characters = s.who.slice(0, Math.min(cast, s.who.length));
    if (cast > s.who.length) characters.push(NARRATOR);

    return {
      level: "junior",
      title: s.title,
      type: type.id,
      cast: cast,
      labels: { type: type.label, cast: cast + " in the group" },
      where: s.where,
      characters: characters,
      plot: {
        exposition: s.exposition,
        conflict: s.conflict,
        rising: s.rising.slice(),
        climaxes: s.climaxes.slice(),
        endings: s.endings.slice()
      },
      picks: { climax: null, resolution: null },
      planned: {},
      combo: s.id
    };
  }

  // What the plot says at each stage, given the group's choices. Returns { text, list, options }.
  function stageContent(stim, id) {
    var p = (stim && stim.plot) || {};
    var picks = (stim && stim.picks) || {};
    if (id === "exposition") return { text: p.exposition };
    if (id === "conflict") return { text: p.conflict };
    if (id === "rising") return { list: p.rising || [] };
    if (id === "climax") {
      return {
        options: (p.climaxes || []).map(function (x) { return x.text; }),
        picked: picks.climax,
        text: chosenText(picks.climax, (p.climaxes || []).map(function (x) { return x.text; }), "Your own climax. Make it the most tense moment in the story.")
      };
    }
    if (id === "falling") {
      var cl = typeof picks.climax === "number" ? (p.climaxes || [])[picks.climax] : null;
      if (cl) return { text: cl.falling };
      if (picks.climax === OWN_IDEA) return { text: "Your own idea. What happens straight after your climax?" };
      return { text: "", waiting: "Choose your climax first." };
    }
    if (id === "resolution") {
      return {
        options: p.endings || [],
        picked: picks.resolution,
        text: chosenText(picks.resolution, p.endings || [], "Your own ending. How is the problem solved?")
      };
    }
    return { text: "" };
  }

  function chosenText(choice, options, ownText) {
    if (choice === OWN_IDEA) return ownText;
    if (typeof choice === "number" && options[choice]) return options[choice];
    return "";
  }

  // A stage can be ticked once any choice it needs has been made.
  function canPlan(stim, id) {
    var picks = (stim && stim.picks) || {};
    if (id === "climax" || id === "falling") return picks.climax != null;
    if (id === "resolution") return picks.resolution != null;
    return true;
  }

  function plannedCount(stim) {
    var planned = (stim && stim.planned) || {};
    return STAGES.filter(function (st) { return planned[st.id]; }).length;
  }

  function escXml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Points on the mountain line for each stage, in a 340 x 170 box.
  var POINTS = {
    exposition: [44, 112], conflict: [100, 112], rising: [159, 71],
    climax: [218, 30], falling: [241, 71], resolution: [298, 112]
  };

  // The plot mountain as inline SVG. Planned stages fill green; opts.links makes each dot a link to #stage-<id>.
  function mountainSvg(stim, opts) {
    opts = opts || {};
    var planned = (stim && stim.planned) || {};
    var compact = !!opts.compact;
    var w = 340, h = 170;
    var out = '<svg class="plot-mountain' + (compact ? " compact" : "") + '" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Plot mountain: ' +
      plannedCount(stim) + ' of 6 stages planned" xmlns="http://www.w3.org/2000/svg">';
    // Beginning / middle / end bands
    out += '<rect x="0" y="0" width="112" height="' + (h - 20) + '" rx="10" fill="rgba(244,166,42,.10)"/>';
    out += '<rect x="116" y="0" width="118" height="' + (h - 20) + '" rx="10" fill="rgba(244,94,104,.13)"/>';
    out += '<rect x="238" y="0" width="102" height="' + (h - 20) + '" rx="10" fill="rgba(53,199,150,.10)"/>';
    if (!compact) {
      out += '<g font-family="Inter,system-ui,sans-serif" font-size="10" font-weight="700" fill="#9AA6C4" text-anchor="middle" letter-spacing="1">' +
        '<text x="56" y="' + (h - 5) + '">BEGINNING</text><text x="175" y="' + (h - 5) + '">MIDDLE</text><text x="289" y="' + (h - 5) + '">END</text></g>';
    }
    // The line
    out += '<path d="M14 112 L100 112 L218 30 L264 112 L326 112" fill="none" stroke="#F5F7FF" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>';
    STAGES.forEach(function (st) {
      var pt = POINTS[st.id];
      var done = !!planned[st.id];
      var dot = '<circle cx="' + pt[0] + '" cy="' + pt[1] + '" r="' + (compact ? 8 : 9) + '" fill="' + (done ? "#35C796" : "#221d2e") +
        '" stroke="' + (done ? "#35C796" : "#C4B4FF") + '" stroke-width="2.5"/>';
      if (done) {
        dot += '<path d="M' + (pt[0] - 4) + " " + pt[1] + " l3 3 l5 -6" + '" fill="none" stroke="#10241c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      }
      if (!compact) {
        // Rising sits left of the slope, falling right of it, the rest under (or over) their dot
        var lx = st.id === "rising" ? pt[0] - 14 : st.id === "falling" ? pt[0] + 14 : pt[0];
        var ly = st.id === "climax" ? pt[1] - 15 : (st.id === "rising" || st.id === "falling") ? pt[1] + 4 : pt[1] + 25;
        var anchor = st.id === "rising" ? "end" : st.id === "falling" ? "start" : "middle";
        dot += '<text x="' + lx + '" y="' + ly + '" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" fill="#F5F7FF" text-anchor="' + anchor + '">' +
          escXml(st.label) + "</text>";
      }
      if (opts.links) dot = '<a href="#stage-' + st.id + '" aria-label="' + escXml(st.label) + '">' + dot + "</a>";
      out += dot;
    });
    out += "</svg>";
    return out;
  }

  root.StimulusJunior = {
    TYPES: TYPES,
    CASTS: CASTS,
    STAGES: STAGES,
    STORIES: STORIES,
    OWN_IDEA: OWN_IDEA,
    generate: generate,
    stageDef: stageDef,
    stageContent: stageContent,
    canPlan: canPlan,
    plannedCount: plannedCount,
    mountainSvg: mountainSvg
  };
})(typeof window !== "undefined" ? window : this);
