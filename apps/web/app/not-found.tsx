export const runtime = 'edge';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-500">페이지를 찾을 수 없습니다</p>
      </div>
    </div>
  );
}
