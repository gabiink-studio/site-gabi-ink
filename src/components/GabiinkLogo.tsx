import logoGabiink from '../assets/logo-gabiink.png';

interface GabiinkLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 60,
  md: 100,
  lg: 150,
  xl: 200,
};

export function GabiinkLogo({ size = 'md', className }: GabiinkLogoProps) {
  const s = sizes[size];
  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <img
        src={logoGabiink}
        alt="Gabiink Tattoo Studio"
        style={{
          width: s,
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}