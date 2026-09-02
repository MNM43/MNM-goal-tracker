import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...rest }: P & { children?: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconPlus = (p: P) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)
export const IconChevronRight = (p: P) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
)
export const IconChevronLeft = (p: P) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
)
export const IconChevronDown = (p: P) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
)
export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
)
export const IconCloud = (p: P) => (
  <Svg {...p}><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.5 4 4 0 0 0 7 19z" /></Svg>
)
export const IconGantt = (p: P) => (
  <Svg {...p}><path d="M4 6h9M4 12h14M4 18h6" /><path d="M15 5v2M20 17v2" /></Svg>
)
export const IconList = (p: P) => (
  <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></Svg>
)
export const IconBoard = (p: P) => (
  <Svg {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></Svg>
)
export const IconCheck = (p: P) => (
  <Svg {...p}><path d="m4 12.5 5 5L20 6.5" /></Svg>
)
export const IconCheckCircle = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></Svg>
)
export const IconTag = (p: P) => (
  <Svg {...p}><path d="M3.5 11.5V5a1.5 1.5 0 0 1 1.5-1.5h6.5l9 9-8 8-9-9Z" /><circle cx="8" cy="8" r="1.3" /></Svg>
)
export const IconChart = (p: P) => (
  <Svg {...p}><path d="M4 20V10M10 20V5M16 20v-7M22 20H2" /></Svg>
)
export const IconSparkles = (p: P) => (
  <Svg {...p}><path d="M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.5 10.4 11.2 6 9.6 10.4 8Z" /><path d="M18.5 15.5 19.2 17.4 21 18 19.2 18.6 18.5 20.4 17.8 18.6 16 18 17.8 17.4Z" /></Svg>
)
export const IconClose = (p: P) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
)
export const IconEdit = (p: P) => (
  <Svg {...p}><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20Z" /><path d="M15 7.5 17.5 10" /></Svg>
)
export const IconTrash = (p: P) => (
  <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></Svg>
)
export const IconDownload = (p: P) => (
  <Svg {...p}><path d="M12 4v11M8 11.5l4 4 4-4M4 20h16" /></Svg>
)
export const IconUpload = (p: P) => (
  <Svg {...p}><path d="M12 16V5M8 8.5l4-4 4 4M4 20h16" /></Svg>
)
export const IconSettings = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Svg>
)
export const IconClock = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>
)
export const IconAlert = (p: P) => (
  <Svg {...p}><path d="M12 4.5 21 19.5H3Z" /><path d="M12 10v4M12 17h.01" /></Svg>
)
export const IconArrowLeft = (p: P) => (
  <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
)
export const IconArrowRight = (p: P) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
)
export const IconCopy = (p: P) => (
  <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></Svg>
)
export const IconRefresh = (p: P) => (
  <Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5.5V11h-5.5" /></Svg>
)
export const IconFolder = (p: P) => (
  <Svg {...p}><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17Z" /></Svg>
)
export const IconTarget = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></Svg>
)
export const IconFlame = (p: P) => (
  <Svg {...p}><path d="M12 22c3.9 0 6.5-2.6 6.5-6 0-4.5-4.5-6-4.5-10-2 2-3 3.5-3 5.5-1-1-1.5-2-1.5-3.5C7.5 9.5 5.5 12 5.5 16c0 3.4 2.6 6 6.5 6Z" /></Svg>
)
export const IconCalendar = (p: P) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></Svg>
)
export const IconLayers = (p: P) => (
  <Svg {...p}><path d="M12 3.5 21 8l-9 4.5L3 8Z" /><path d="m3 13 9 4.5L21 13" /><path d="m3 17.5 9 4.5 9-4.5" /></Svg>
)
export const IconMore = (p: P) => (
  <Svg {...p}><circle cx="5.5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18.5" cy="12" r="1.4" /></Svg>
)
