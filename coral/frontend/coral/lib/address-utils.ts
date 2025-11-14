export function formatAddress(address: string, length = 6): string {
  return `...${address.slice(-length)}`
}

export function getAddressColor(address: string): string {
  // Generate a consistent color based on address
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-indigo-500",
    "bg-cyan-500",
    "bg-teal-500",
  ]

  // Use last few characters to determine color
  const lastChars = address.slice(-4)
  const sum = lastChars.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[sum % colors.length]
}
