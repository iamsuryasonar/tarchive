export const emptyPopUpFallbackMessages = [
    "No tabs open right now. Time to focus? 😌",
    "You're all clear. No tabs in sight.",
    "No active tabs found in this window.",
    "Your browser tab ocean is calm 🧘",
    "Nothing here. Hit ‘Add’ when you're ready to save some tabs!",
];

export function getEmptyPopUpFallBackMessage() {
    return emptyPopUpFallbackMessages[Math.floor(Math.random() * emptyPopUpFallbackMessages.length)];
}
