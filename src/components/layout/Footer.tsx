export function Footer() {
  return (
    <footer className="bg-[#1E293B] text-[#CBD5E1] py-12 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Contacts */}
        <div>
          <h3 className="font-heading text-xl font-bold text-white mb-4">Contact Us</h3>
          <ul className="space-y-2">
            <li>
              <span className="font-medium">Phone:</span> +1 (800) 555-TOUR
            </li>
            <li>
              <span className="font-medium">Email:</span> support@tourwise.app
            </li>
            <li>
              <span className="font-medium">Office:</span> 123 Adventure Ave, Wanderlust City, WL 98765
            </li>
          </ul>
        </div>

        {/* Right Column - Affiliations */}
        <div>
          <h3 className="font-heading text-xl font-bold text-white mb-4">Our Affiliations</h3>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="px-4 py-2 bg-white/10 rounded-md text-sm font-medium">Wander Group</div>
            <div className="px-4 py-2 bg-white/10 rounded-md text-sm font-medium">TrekSafe</div>
            <div className="px-4 py-2 bg-white/10 rounded-md text-sm font-medium">EcoTravels</div>
            <div className="px-4 py-2 bg-white/10 rounded-md text-sm font-medium">Global Guides</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
