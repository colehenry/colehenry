/**
 * The 25 challenges - static content, mirrored nowhere in the DB. The API
 * stores only state (order + completions) keyed by these ids.
 * Milestone dates must match backend/app/routers/challenges.py exactly.
 */
export type Challenge = { id: number; title: string; desc: string };

export const CHALLENGES: Challenge[] = [
  { id: 1, title: "Explore Without Destination", desc: "Pick a direction and walk into a part of your city you've never seen. No route, no goal, no errand attached. Let yourself get a little lost and actually look at what's around you. Give it an hour before you head back." },
  { id: 2, title: "Dine in Solitude", desc: "Eat a full sit-down meal alone at a restaurant. Phone stays in your pocket the whole time. Sit with the food and the quiet, and notice what it feels like to be alone in public without hiding behind a screen." },
  { id: 3, title: "A Real Conversation With a Stranger", desc: "Have an actual conversation with someone you don't know. Get past the weather and the pleasantries - ask about their work, their life, what they care about. Aim for something you'll still remember tomorrow." },
  { id: 4, title: "Walk Into a Room of Strangers", desc: "Go to a local event where you know literally no one - a meetup, a class, a show. Stay for the whole thing instead of finding a reason to leave early." },
  { id: 5, title: "Watch the Sunrise", desc: "Wake up before first light and watch the sky change. Just once. Don't film it for anyone. Just be there while it happens." },
  { id: 6, title: "Say the Hard Thing Out Loud", desc: "If you're single: ask out the person you've been avoiding out of fear. A no costs you nothing you don't already have. If you're with someone: tell your partner one true thing you've been holding back - a need, a fear, an insecurity, a desire - without softening it or turning it into a joke." },
  { id: 7, title: "Take One Combat Class", desc: "Sign up for boxing, BJJ, or MMA and show up for a single class. The point isn't to be good at it - it's to feel real physical discomfort and learn you can stay in it." },
  { id: 8, title: "Get in the Cold", desc: "Do a cold plunge or ice bath and stay in for two minutes. Your body will want out in the first ten seconds. Stay anyway, and pay attention to how fast the panic passes." },
  { id: 9, title: "Host Something Yourself", desc: "Put a social event together with your own name on it. Pick the plan, invite the people, choose the place. Be the one responsible for it actually happening instead of waiting to be invited." },
  { id: 10, title: "Say Yes to the Next One", desc: "The next invitation you'd normally turn down - take it. Show up even if it's not your usual thing, and see what the night turns into." },
  { id: 11, title: "Mail a Handwritten Card", desc: "Pick someone who matters to you and send a real card in the mail. Write the thing you usually assume they already know. It's easy to take the steady people for granted." },
  { id: 12, title: "Learn to Cook Five Meals", desc: "Get five meals to the point where you can make them without a recipe. Not just following steps - understand why each one works, so you could adjust it on the fly." },
  { id: 13, title: "A Night Out, Alone", desc: "Go out to the bars by yourself. Talk to people, let a group pull you in, and see where the night goes without the safety net of your own friends around you." },
  { id: 14, title: "Make Something With Your Hands", desc: "Learn one hands-on skill and use it to fix, build, or make something real. End the challenge with an object that exists because you made it exist." },
  { id: 15, title: "Repay a Family Member", desc: "Do something concrete to thank a family member - a surprise trip home, a night out, a real gesture. Make the effort obvious enough that they feel it." },
  { id: 16, title: "Call Someone You've Lost Touch With", desc: "Call a person you haven't spoken to in over a year. No agenda, no reason required. Just check in and see how they are." },
  { id: 17, title: "Take a Solo Trip", desc: "Travel somewhere on your own - even one night in a new city. Handle the whole thing yourself, start to finish. You'll come back a little different." },
  { id: 18, title: "One Full Day Offline", desc: "Spend an entire day with no phone and no screens. Plan around it beforehand so you're not tempted. Fill the hours with the physical world in front of you." },
  { id: 19, title: "Show Up for 30 Days Straight", desc: "Join a team, class, or club and turn up every day for a month. The activity barely matters - the point is proving to yourself you can keep a streak." },
  { id: 20, title: "Help Someone in Person", desc: "Spend an afternoon helping face to face - volunteering or helping a stranger directly. Not a donation, not a comment online. Real, in-person effort." },
  { id: 21, title: "Ten Minutes of Silence, Daily", desc: "Sit in silence for ten minutes every morning for two weeks. No music, no podcast, no phone. Just you and whatever your head does when it has nothing to grab onto." },
  { id: 22, title: "Write to Your Younger Self", desc: "Write a letter to yourself at twenty. Be honest about what you got wrong and what you got right. Read it back and notice what it tells you about where you are now." },
  { id: 23, title: "Fast for a Day", desc: "Fast from sunrise to sunset - water only. Prove to yourself that being hungry and uncomfortable won't break you. (Skip this one if you have any medical reason not to fast.)" },
  { id: 24, title: "Do the Thing You Loved as a Kid", desc: "Find one thing you loved as a child and do it again, fully, without caring how it looks. See if any of it still lands the way it used to." },
  { id: 25, title: "Write Down the Life You Actually Want", desc: "Spell out, in detail, what your ideal life actually looks like - where, with whom, doing what. Most people never put it into words, which is part of why they never build it." },
];

export const CHALLENGES_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

/** ISO date (yyyy-mm-dd) → "Jul 14" without timezone surprises. */
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MON[m - 1]} ${d}`;
}
