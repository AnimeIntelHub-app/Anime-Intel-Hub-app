import { Play } from 'lucide-react';
import { useState } from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
}

export default function AppLogo({ className = "w-12 h-12", size = 24 }: AppLogoProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={`${className} bg-indigo-500 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center`}>
        <Play className="text-black fill-black ml-0.5" size={size} />
      </div>
    );
  }

  return (
    <img 
      src="/logo.png" 
      alt="App Logo" 
      className={`${className} rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] object-cover bg-obsidian-900 border border-white/5`}
      onError={() => setError(true)}
    />
  );
}
