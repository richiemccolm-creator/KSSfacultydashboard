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
      ["The brush is locked away where nobody can find it.", "The dragon comes back to visit once a year."]),

    // FUNNY (more)
    story("funny-6", "funny", "Granny's New Phone", "A classroom during a quiet test",
      [r("The grandchild", "to get through the test without being embarrassed"), r("Granny, on the big screen", "to say hello to everyone"), r("The teacher", "for the class to stay quiet"), r("The class joker", "to make the most of it"), r("A classmate who loves Granny", "to chat to her")],
      "The class is doing a test. It is so quiet you can hear the clock ticking.",
      "Granny has a new phone, and she has accidentally video called the classroom's big screen!",
      ["Granny cannot work out how to hang up.", "She starts showing everyone baby photos of her grandchild.", "She turns on a filter that gives her bunny ears."],
      [c("Granny starts singing Happy Birthday, even though it is nobody's birthday.", "The whole class joins in."),
       c("The grandchild grabs the remote and makes Granny's face fill the whole wall.", "Granny finally waves goodbye and the screen goes dark.")],
      ["Granny becomes the class's favourite visitor.", "The grandchild teaches Granny how to use her phone properly."]),
    story("funny-7", "funny", "The Sneezing Statue", "A museum on a school trip",
      [r("The pupil pretending to be a statue", "to not get caught"), r("Their friend", "to help them sneak back to the group"), r("The tour guide", "to give a perfect tour"), r("The teacher", "to find the missing pupil"), r("A small child on the tour", "to touch everything")],
      "The class is on a trip to a museum full of old statues.",
      "A pupil wanders off, and the only way to hide from the teacher is to stand very still and pretend to be a statue.",
      ["A fly lands on their nose.", "The tour guide stops right in front of them to talk about \"this famous statue\".", "They really, really need to sneeze."],
      [c("They let out the biggest sneeze ever.", "The tour group screams, then bursts out laughing."),
       c("A small child starts tickling the statue.", "The statue cannot stop giggling.")],
      ["The museum asks them to come back as a living statue for a special event.", "The teacher makes them write a report on all the real statues."]),
    story("funny-8", "funny", "The Dog Show Disaster", "A village dog show on a sunny afternoon",
      [r("The dog walker", "to win a rosette for their neighbour"), r("The dog", "to have as much fun as possible"), r("The judge", "to find the best behaved dog"), r("A very posh rival owner", "to win, as always"), r("The neighbour who owns the dog", "to be proud of their pet")],
      "It is the village dog show. A pupil is showing their neighbour's dog for the first time.",
      "It is their turn in the ring, and the dog will not do a single thing it is told.",
      ["The dog sits down and refuses to move.", "The dog steals the judge's sandwich.", "The dog jumps into the paddling pool and shakes water over everyone."],
      [c("At the very last second, the dog does a perfect trick.", "The crowd cheers."),
       c("The dog knocks the judge into the paddling pool.", "The judge climbs out, dripping, and starts to laugh.")],
      ["They win a rosette for Most Fun Dog.", "The posh rival's dog and their dog become best friends."]),
    story("funny-9", "funny", "The Chicken King", "Backstage at the school play",
      [r("The lead actor", "to look like a real king"), r("The costume helper", "to fix the mistake"), r("The director", "for the play to be taken seriously"), r("Another actor on stage", "to not laugh"), r("A parent in the front row", "to film their child's big moment")],
      "It is the opening night of the school play. The lead is playing a king.",
      "The costumes have been mixed up. Instead of a king's robe, the lead has a giant chicken costume!",
      ["There is no time to change.", "The other actors are trying very hard not to laugh.", "The chicken costume squeaks every time they move."],
      [c("The lead plays the king as a chicken, completely seriously.", "The audience cannot stop laughing."),
       c("The chicken costume gets stuck in the scenery.", "The whole cast has to pull them free.")],
      ["The director keeps the chicken king for every show.", "The chicken king becomes a school legend."]),
    story("funny-10", "funny", "The Soggy Shopping List", "A busy supermarket",
      [r("The pupil doing the shopping", "to get everything right"), r("Their friend", "to help, and have fun"), r("The shop manager", "to keep the shop tidy"), r("A helpful shopper", "to give advice"), r("The parent at home", "to make tea tonight")],
      "A parent sends two friends to the shop with a list and some money.",
      "The list gets soaked in the rain. All they can read is \"eggs... 20... banana... cake?\"",
      ["They guess, and fill the trolley with 20 bananas.", "They knock over a tower of tins.", "The shop manager starts following them round the shop."],
      [c("They get home and the parent opens the bags.", "The parent stares, then starts laughing."),
       c("The trolley rolls away down the aisle towards a big display.", "The manager catches it just in time.")],
      ["They make a giant banana cake for the whole street.", "Next time, they take a photo of the list."]),

    // SPOOKY (more)
    story("spooky-6", "spooky", "The Talking Doll", "A house with a doll from a charity shop",
      [r("The pupil who bought the doll", "to find out why it talks"), r("Their brother or sister", "to play a trick"), r("The charity shop owner", "to help"), r("The doll's first owner, now grown up", "to find a toy they lost long ago"), r("A parent", "to get some peace and quiet")],
      "A pupil buys an old doll from a charity shop and puts it on their shelf.",
      "That night, the doll whispers: \"Find me.\"",
      ["The doll keeps moving to different rooms.", "Its eyes are open in the middle of the night.", "It says a name that nobody in the family knows."],
      [c("They take the doll back to the shop. The owner says the name belonged to her sister.", "The doll goes quiet."),
       c("They find a speaker hidden in the doll. Their brother or sister has been doing the voice.", "The chase round the house begins.")],
      ["The doll goes back to its first owner, who cries happy tears.", "The two of them spend the week playing tricks on each other."]),
    story("spooky-7", "spooky", "The Fog on the Field", "The school football pitch on a misty evening",
      [r("The goalkeeper", "to keep the team together"), r("The striker", "to finish the match"), r("The player who disappears", "to find their way back"), r("The coach", "to get everyone home safe"), r("A footballer from 100 years ago", "to play one last game")],
      "It is an evening football match. The light is fading.",
      "A thick fog rolls over the pitch, and one player vanishes into it.",
      ["A whistle blows from somewhere inside the fog.", "Their footprints stop in the middle of the pitch.", "They hear a crowd cheering, but the stands are empty."],
      [c("They find the missing player holding an old leather football from 100 years ago.", "The fog begins to lift."),
       c("The missing player jumps out of the fog shouting \"Boo!\"", "The whole team chases them round the pitch.")],
      ["They put the old football in the school trophy cabinet.", "They finish the match, and win."]),
    story("spooky-8", "spooky", "The Library After Dark", "The school library on book week sleepover night",
      [r("The book lover", "to read all night"), r("The scared one", "to keep the lights on"), r("The joker", "to tell the scariest story"), r("The librarian", "to make the night special"), r("The ghost of the first librarian", "for the old books to be read again")],
      "It is book week. The class is having a sleepover in the school library.",
      "When the lights go out, books start falling off the shelves on their own.",
      ["Pages flutter, but there is no wind.", "A torch beam shows a shadow between the shelves.", "A book opens on its own, at a page with their names written in it."],
      [c("The librarian turns the lights on. It was a surprise ghost story night.", "Everyone laughs, a bit too loudly."),
       c("They find a hidden letter from the very first librarian, asking for her books to be read.", "The books stop falling.")],
      ["They read the old books out loud to each other until morning.", "They start a club to look after the oldest books."]),
    story("spooky-9", "spooky", "Knocks in the Wall", "A bedroom in an old house the family has just moved into",
      [r("The pupil who hears the knocks", "to find out where they come from"), r("Their brother or sister", "to prove it is nothing"), r("A parent", "for everyone to settle into the new house"), r("The new neighbour", "to make a friend"), r("The neighbour's parent", "to say welcome")],
      "The family has just moved into an old house. It is the first night in the new bedroom.",
      "At bedtime, there are three knocks from inside the wall.",
      ["They knock back, and the wall knocks again.", "A drawing is pushed under the bedroom door.", "A parent says the house next door is empty."],
      [c("Behind a loose panel, they find a frightened cat that has been stuck there.", "They give it some milk and it starts to purr."),
       c("The house next door is not empty. A new kid has just moved in, and has been knocking from the other side.", "They both burst out laughing through the wall.")],
      ["They keep the cat.", "They become best friends with the kid next door."]),
    story("spooky-10", "spooky", "The Halloween Dare", "A dark street on Halloween night",
      [r("The pupil who is dared", "to prove they are brave"), r("The friend who made the dare", "to see what happens"), r("The careful friend", "to go home"), r("The old lady in the spooky house", "to have some visitors"), r("Her grandchild", "to make the old lady happy")],
      "It is Halloween. A group of friends are out trick-or-treating.",
      "They dare one friend to knock on the door of the spookiest house on the street.",
      ["The gate creaks open on its own.", "A pumpkin on the step lights up by itself.", "The door opens before they have even knocked."],
      [c("An old lady in a witch costume says: \"Come in, dears.\"", "Inside, there is a Halloween party."),
       c("The friend who made the dare jumps out in a mask.", "Everyone screams and runs.")],
      ["They visit the old lady every week after that.", "Her house gives out the best sweets in town every Halloween."]),

    // MYSTERY (more)
    story("mystery-6", "mystery", "The Disappearing Sandwiches", "A classroom with the windows open",
      [r("The pupil detective", "to catch the thief"), r("Their friend", "to help set a trap"), r("The pupil who looks guilty", "to be left alone"), r("The teacher", "for everyone to have lunch"), r("A cheeky seagull", "to eat sandwiches")],
      "It is the week before the holidays. It is warm, so the windows are open.",
      "Every day, someone's sandwiches vanish from their bag.",
      ["The detective sets a trap with an extra spicy sandwich.", "Crumbs are found by the window.", "One pupil has a red face and keeps drinking water."],
      [c("They catch the thief in the act. It is a seagull flying in through the window.", "Everyone turns to the red-faced pupil, who had chilli for lunch."),
       c("The red-faced pupil admits they took the sandwiches because they were hungry.", "The class goes quiet, and nobody laughs.")],
      ["The windows stay shut, and the seagull gets its own bird table.", "The class starts a breakfast club so nobody goes hungry."]),
    story("mystery-7", "mystery", "The Muddy Footprints", "The school hall, just before assembly",
      [r("The first detective", "to solve the case before assembly"), r("The second detective", "to find the culprit"), r("The caretaker", "for the clean floor to stay clean"), r("The new pupil with muddy boots", "to keep a secret"), r("The headteacher", "for assembly to start on time")],
      "The caretaker has just cleaned the hall floor for assembly. It is shining.",
      "A trail of muddy footprints goes right across the clean floor!",
      ["The footprints lead to the stage.", "They are too small to be a grown-up's.", "The new pupil has muddy boots."],
      [c("Behind the stage curtain, they find a little fox cub.", "They gently lead it back outside."),
       c("The new pupil admits they ran in to find their lucky trainer.", "The caretaker forgives them.")],
      ["The fox cub is seen playing on the field with its mum.", "The new pupil helps the caretaker clean the hall."]),
    story("mystery-8", "mystery", "The Secret Code", "A classroom, first thing in the morning",
      [r("The code breaker", "to solve every clue"), r("Their friend", "to find out who is sending the messages"), r("The teacher", "to start the lesson"), r("The headteacher", "to keep a surprise"), r("The caretaker's child", "to join in")],
      "Every morning, the class arrives to find a message in code on the whiteboard.",
      "Nobody knows who is writing the messages, or what they mean.",
      ["They crack the first code: \"Look under\".", "The next day: \"the oldest\".", "The last message: \"tree\"."],
      [c("Under the oldest tree in the playground, they find a box from the headteacher.", "Inside is a letter about a surprise class trip."),
       c("They hide and catch the code writer. It is the caretaker's child, who wanted to join in.", "Everyone is amazed at how clever the codes were.")],
      ["They go on the trip.", "The caretaker's child writes a new code for the class every week."]),
    story("mystery-9", "mystery", "The Missing Recipe", "A school baking competition",
      [r("The baker", "to win with Granny's recipe"), r("The rival baker", "to win at any cost"), r("The judge", "to find the tastiest cake"), r("Granny, who wrote the recipe", "for her secret to stay safe"), r("The detective friend", "to find the recipe")],
      "It is the school baking competition. A pupil is going to bake Granny's famous cake.",
      "The recipe card has gone missing!",
      ["There are floury fingerprints on the table.", "The rival is baking the very same cake.", "Granny says there is a secret ingredient that is not on the card."],
      [c("The judge tastes the rival's cake. It tastes wrong, because they did not know the secret.", "The rival admits they took the card."),
       c("The card is found stuck to the bottom of a mixing bowl.", "Everyone says sorry to the rival.")],
      ["Granny teaches both bakers the secret ingredient.", "The two bakers enter next year's competition as a team."]),
    story("mystery-10", "mystery", "Who Rang the Bell?", "A primary and secondary school campus",
      [r("The detective", "to find out who keeps ringing the bell"), r("Their friend", "to get out of class early"), r("The office worker", "to stop the chaos"), r("The headteacher", "for the day to run normally"), r("A small child from the primary school", "to press the big red button")],
      "It is a normal school day, until the bell rings.",
      "The school bell keeps ringing at the wrong times, and nobody knows why.",
      ["The bell rings ten minutes early for lunch.", "The office says nobody pressed the button.", "They find a remote control in lost property."],
      [c("They catch a little primary pupil pressing the bell button for fun.", "The little pupil looks very sorry."),
       c("They discover the headteacher's phone app has a glitch that rings the bell.", "The headteacher goes very red.")],
      ["The little pupil gets a special job ringing the bell on the last day of term.", "The app is fixed, but everyone wishes lunch was early every day."]),

    // ADVENTURE (more)
    story("adventure-6", "adventure", "Snowed In", "A cabin in the mountains on a school trip",
      [r("The leader", "to keep everyone warm"), r("The fire builder", "to get a fire going"), r("The cook", "to make the food last"), r("The friend who gets too cold", "to feel warm again"), r("The teacher", "to get help")],
      "The class is on a winter trip, staying in a wooden cabin.",
      "A huge snowstorm traps them inside, and the heating stops working.",
      ["The power goes off.", "The food starts to run out.", "One friend gets far too cold."],
      [c("They all work together to light a fire in the old stove.", "Everyone huddles round it, warm at last."),
       c("They hear an engine. A snowplough has come to dig them out.", "They cheer and wave through the window.")],
      ["They get home safely and tell everyone the story.", "They go back the next winter, with a lot more food."]),
    story("adventure-7", "adventure", "The Escape Room", "An escape room on a class trip",
      [r("The leader", "to escape in time"), r("The puzzle solver", "to crack the last code"), r("The quiet one", "to be listened to"), r("The panicker", "to get out right now"), r("The game host", "to watch them on camera")],
      "The class goes to an escape room. They have one hour to solve the clues.",
      "There is one clue left, and only two minutes on the clock.",
      ["The lights turn red and an alarm starts.", "The last clue is written backwards.", "The group starts arguing."],
      [c("The quiet one cracks the code with one second left.", "The door swings open."),
       c("The timer runs out, but the host lets them have one more try.", "They work together this time.")],
      ["They escape and get their photo on the wall of fame.", "They learn to listen to each other."]),
    story("adventure-8", "adventure", "The Charity Bike Ride", "Country roads on a charity bike ride",
      [r("The rider", "to finish the ride"), r("Their friend", "to stick together"), r("A rider who falls off", "to get to the finish"), r("The event organiser", "for everyone to finish safely"), r("A parent at the finish line", "to see their child finish")],
      "Two friends are doing a long bike ride to raise money for charity.",
      "Miles from the finish, a bike chain snaps.",
      ["It starts to pour with rain.", "They take a wrong turn.", "Everyone else has passed them. They are last."],
      [c("They push the bike all the way to the finish line.", "The crowd cheers louder than for the winners."),
       c("They stop to help another rider who has fallen off.", "All three of them go on together.")],
      ["They raise more money than anyone else.", "They become friends with the rider they helped."]),
    story("adventure-9", "adventure", "The Penguin Escape", "A zoo on a school work-experience day",
      [r("The pupil helping at the zoo", "to impress the zookeeper"), r("Their friend", "to help catch the penguin"), r("The zookeeper", "to get the penguin back safely"), r("The cafe owner", "to keep the penguin out of the kitchen"), r("The penguin", "to explore")],
      "Two pupils are helping out for the day at the zoo.",
      "They leave a gate open, and a penguin escapes!",
      ["The penguin slides into the gift shop.", "It waddles into the cafe kitchen.", "It heads straight for the main gates."],
      [c("They make a trail of fish to lead the penguin back home.", "The penguin follows, one fish at a time."),
       c("The zookeeper slips over, and the pupils have to catch the penguin themselves.", "They carry it back, very carefully.")],
      ["The zoo gives them a free ticket for a year.", "They get to name the next baby penguin."]),
    story("adventure-10", "adventure", "The Lighthouse", "A lighthouse during a storm",
      [r("The grandchild", "to help Grandpa"), r("Their friend", "to be brave"), r("Grandpa, the lighthouse keeper", "to keep the light shining"), r("The captain of a fishing boat", "to get home safe"), r("The coastguard on the radio", "to guide the boat in")],
      "Two friends are staying with Grandpa, the lighthouse keeper.",
      "A storm hits, the light goes out, and a fishing boat is heading for the rocks.",
      ["The power is cut.", "Grandpa hurts his ankle on the stairs.", "The stairs to the top are completely dark."],
      [c("They climb to the top and switch on the emergency light.", "The boat turns away from the rocks."),
       c("They run to the rocks with torches and flash a signal to the boat.", "The captain sees them and steers to safety.")],
      ["The fishing crew bring them a thank-you present.", "Grandpa says they are the best lighthouse helpers he has ever had."]),

    // REAL LIFE (more)
    story("real-6", "real", "The Team Trials", "The school football pitch and the bus home",
      [r("The friend who makes the team", "to keep both their friend and their place"), r("The friend who does not", "to feel happy for their friend"), r("The coach", "to pick the best team"), r("A new teammate", "to make friends"), r("A parent", "to help their child feel better")],
      "Two best friends try out for the school football team together.",
      "One makes the team, and the other does not.",
      ["The friend who made it spends every break with the team.", "They miss their best friend's birthday because of training.", "A teammate makes a joke about the friend who did not get in."],
      [c("The two friends have a big argument at the school gate.", "They walk home on opposite sides of the road."),
       c("The friend on the team stands up to the teammate who made the joke.", "The other friend sees it happen.")],
      ["They make up, and the friend comes to every match to cheer.", "The friend who missed out keeps practising, and gets in next year."]),
    story("real-7", "real", "The Twenty Pound Note", "The school playground at break",
      [r("The pupil who finds the money", "to do the right thing"), r("The friend who says keep it", "to spend it on sweets"), r("The careful friend", "to hand it in"), r("The pupil who lost it", "to get their trip money back"), r("The teacher on duty", "to sort it out")],
      "It is break time. A pupil finds a twenty pound note on the ground.",
      "Nobody saw them pick it up. Should they keep it?",
      ["A friend says: \"Finders keepers!\"", "They see a younger pupil crying near the office.", "The ice cream van pulls up outside the gate."],
      [c("They walk over and give the money back to the crying pupil.", "The pupil's face lights up."),
       c("They spend some of it, then find out it was a younger pupil's trip money.", "Their stomach drops.")],
      ["The younger pupil's parent writes them a thank-you note.", "They own up, pay the money back, and feel lighter."]),
    story("real-8", "real", "The Class Election", "A classroom on election day",
      [r("The pupil standing for class rep", "to win, to change something they care about"), r("The popular pupil also standing", "to win, because they always do"), r("The campaign helper", "to get votes"), r("The teacher", "for the vote to be fair"), r("The undecided voter", "to choose the best person")],
      "The class is voting for a new class rep. Two pupils are standing.",
      "One is quiet and has good ideas. The other is the most popular pupil in the year.",
      ["Someone tears down the quiet pupil's posters.", "A rumour spreads that they will cancel golden time.", "On the day of the speeches, they freeze."],
      [c("They put their notes down and speak from the heart.", "The room goes silent, then claps."),
       c("The popular pupil tells the class the rumour is not true.", "Everyone is surprised.")],
      ["The quiet pupil wins.", "The two of them decide to share the job."]),
    story("real-9", "real", "Grandpa Comes to School", "A classroom on careers day",
      [r("The grandchild", "to not be embarrassed"), r("Grandpa", "to make his grandchild proud"), r("The teacher", "for the class to learn something"), r("The class joker", "to make everyone laugh"), r("A pupil who is fascinated", "to hear more")],
      "It is careers day. Visitors are coming in to talk about their jobs.",
      "The next visitor is Grandpa, and the grandchild wants to hide under the table.",
      ["Grandpa arrives wearing a very silly hat.", "He tells everyone an embarrassing baby story.", "The class starts to giggle."],
      [c("Grandpa tells the story of the day he rescued a family from a fire.", "The whole class goes silent."),
       c("The grandchild shouts \"Stop it!\" in front of everyone.", "Grandpa goes quiet and looks at the floor.")],
      ["The grandchild proudly asks Grandpa to come back next year.", "The grandchild says sorry, and they go for ice cream together."]),
    story("real-10", "real", "The Group Chat Photo", "School and the class group chat",
      [r("The pupil in the photo", "for the photo to disappear"), r("The pupil who posted it", "to get a laugh"), r("A good friend", "to help"), r("The teacher", "to sort it out fairly"), r("A pupil who keeps sharing it", "to fit in")],
      "Everyone in the class is in a group chat.",
      "Someone posts an embarrassing photo of a classmate in the chat.",
      ["The photo gets shared again and again.", "The pupil in the photo stops coming to lunch.", "The person who posted it says: \"It's only a joke.\""],
      [c("A friend asks the poster to delete it, in front of everyone.", "The poster goes red, and deletes it."),
       c("The pupil in the photo calmly tells the poster how it made them feel.", "For once, the poster has nothing to say.")],
      ["The poster says sorry, and means it.", "The class agrees some new rules for the group chat."]),

    // FANTASY & SCI-FI (more)
    story("fantasy-6", "fantasy", "The Shrinking Potion", "A science lab",
      [r("The pupil who drinks the potion", "to get back to normal size"), r("Their friend, also shrunk", "to stay safe"), r("The science teacher", "to find out where they went"), r("The class cat", "to catch the tiny moving things"), r("A pupil at full size", "to help without stepping on them")],
      "It is a science lesson. The class is mixing coloured liquids.",
      "Two pupils drink a potion by mistake and shrink to the size of a pencil!",
      ["They are nearly stepped on.", "The class cat spots them.", "The cure is on the top shelf."],
      [c("They ride on the cat's back to reach the top shelf.", "They drink the cure and start to grow."),
       c("A full-size pupil finally hears their tiny voices and lifts them up.", "They reach the cure just in time.")],
      ["They grow back to normal and never touch a potion again.", "They keep one drop of the potion, just in case."]),
    story("fantasy-7", "fantasy", "The Dragon Egg", "A school, and the sky above it",
      [r("The pupil who finds the egg", "to keep the baby dragon safe"), r("Their friend", "to keep the secret"), r("The baby dragon", "to find its mum"), r("The teacher", "to find out what is causing the chaos"), r("The mother dragon", "to find her baby")],
      "On the way to school, a pupil finds a big, warm, glittery egg.",
      "In the middle of a lesson, it hatches into a baby dragon!",
      ["They hide the dragon in a school bag.", "It sneezes fire and sets off the fire alarm.", "A huge shadow flies over the school. Its mum is looking for it."],
      [c("They carry the baby to the school roof to meet its mum.", "The mother dragon gently picks it up."),
       c("The mother dragon lands in the playground, and the whole school sees.", "The baby flies straight to her.")],
      ["The dragons fly away, and leave a shiny scale as a thank-you.", "The dragons come back to visit the school every spring."]),
    story("fantasy-8", "fantasy", "Swap Day", "A school, for one very strange day",
      [r("The pupil, now in the teacher's body", "to get their own body back"), r("The teacher, now in the pupil's body", "to survive a school day"), r("The pupil's best friend", "to help them swap back"), r("The headteacher", "for the school day to run normally"), r("The pupil's parent", "to hear how school is going")],
      "It is a normal day, until a strange flash of light in the classroom.",
      "A pupil and their teacher wake up in each other's bodies!",
      ["The pupil has to teach a maths lesson.", "The teacher has to sit a spelling test.", "Parents' evening is tonight."],
      [c("At parents' evening, the parent talks to the \"teacher\", who is really their child.", "The parent is very confused."),
       c("They realise that to swap back, they must each say something kind about the other.", "They say it, and there is another flash.")],
      ["They swap back, and understand each other much better.", "The teacher gives the class a day off homework."]),
    story("fantasy-9", "fantasy", "Inside the Video Game", "The inside of a video game",
      [r("The gamer", "to win and get home"), r("Their friend", "to get out alive"), r("The sidekick from the game", "to help the players"), r("The final boss", "to stop anyone winning"), r("A parent at home", "to find out why the game is on so loud")],
      "Two friends are playing their favourite video game after school.",
      "A flash from the screen pulls them inside the game, and they have only three lives.",
      ["They lose a life falling into lava.", "They reach the final boss.", "They are down to their last life."],
      [c("They beat the boss by working as a team.", "A door opens back to the real world."),
       c("They find out the boss is only angry because nobody plays with it.", "They make friends with the boss.")],
      ["They land back on the sofa, and never play that level again.", "The boss now helps them in every game."]),
    story("fantasy-10", "fantasy", "The Invisible Pupil", "A school, on a day when one pupil cannot be seen",
      [r("The invisible pupil", "to be seen again"), r("Their best friend", "to find out where they are"), r("The teacher", "to take the register"), r("A pupil who is being unkind", "to show off"), r("A pupil who is being kind", "to help someone who is sad")],
      "A pupil wakes up and goes to school as normal.",
      "Nobody can see them. They have turned invisible!",
      ["Nobody notices they are missing.", "Their best friend gets worried and starts searching.", "They hear what people say about them when they think they are not there."],
      [c("They suddenly become visible again in the middle of assembly.", "The whole school gasps."),
       c("They secretly help their best friend, who realises who it is.", "The friend whispers: \"I knew you were here.\"")],
      ["They come back, and know who their real friends are.", "They become visible again, and are kinder to everyone."])
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
