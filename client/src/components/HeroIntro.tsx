type Props = {
  onUploadClick: () => void
  shopUrl: string
}

export default function HeroIntro({ onUploadClick, shopUrl }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      
      <h1 className="text-3xl font-bold mb-4 text-[#452F60]">
        Yaya's Creative Studio
      </h1>

      <h2 className="text-lg font-medium mb-2 text-[#9867DA]">
        Bead Pattern Converter Tool
      </h2>

      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Upload any image and instantly convert it into a bead pattern
        using our official Artkal 221 color palette.
        <br />
        Automatically calculate bead quantities and order all required
        colors in one click.
      </p>

      <div className="flex gap-4">
        <button
          onClick={onUploadClick}
          className="px-6 py-2 rounded-lg bg-[#9867DA] text-white hover:opacity-90 transition"
        >
          Upload Image
        </button>

        <a
          href={shopUrl}
          target="_blank"
          className="px-6 py-2 rounded-lg border border-[#9867DA] text-[#9867DA] hover:bg-[#9867DA]/10 transition"
        >
          Visit Shop
        </a>
      </div>

      <div className="mt-8 text-xs text-muted-foreground">
        Convert • Optimize • Export Pattern • One-Click Material Order
      </div>
    </div>
  )
}